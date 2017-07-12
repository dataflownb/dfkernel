# -*- coding: utf-8 -*-
"""A ZMQ-based subclass of InteractiveShell.

This code is meant to ease the refactoring of the base InteractiveShell into
something with a cleaner architecture for 2-process use, without actually
breaking InteractiveShell itself.  So we're doing something a bit ugly, where
we subclass and override what we want to fix.  Once this is working well, we
can go back to the base class and refactor the code for a cleaner inheritance
implementation that doesn't rely on so much monkeypatching.

But this lets us maintain a fully working IPython as we develop the new
machinery.  This should thus be thought of as scaffolding.
"""

# Copyright (c) IPython Development Team.
# Distributed under the terms of the Modified BSD License.

from __future__ import print_function

import os
import builtins as builtin_mod
import sys
import time
import warnings
from threading import local

from tornado import ioloop

from IPython.core.interactiveshell import (
    InteractiveShell, InteractiveShellABC
)
from IPython.core import page
from IPython.core.interactiveshell import ExecutionResult
from IPython.core.compilerop import CachingCompiler, check_linecache_ipython
from IPython.core.autocall import ZMQExitAutocall
from IPython.core.displaypub import DisplayPublisher
from IPython.core.error import UsageError
from IPython.core.magics import MacroToEdit, CodeMagics
from IPython.core.magic import magics_class, line_magic, Magics, cell_magic
from IPython.core import payloadpage
from IPython.core.usage import default_banner
from IPython.core.history import HistoryManager
from IPython.core.error import InputRejected, UsageError
from IPython.display import display, Javascript
from ipykernel import (
    get_connection_file, get_connection_info, connect_qtconsole
)
from IPython.utils import openpy
from ipykernel.jsonutil import json_clean, encode_images
from IPython.utils.process import arg_split
from ipython_genutils import py3compat
from ipython_genutils.py3compat import unicode_type
from traitlets import (
    Instance, Type, Dict, CBool, CBytes, Any, default, observe, validate
)
from dfkernel.displayhook import ZMQShellDisplayHook
from collections import defaultdict, namedtuple
from jupyter_core.paths import jupyter_runtime_dir
from jupyter_client.session import extract_header, Session
from traitlets import (
    Integer, Bool, CaselessStrEnum, Enum, List, Dict, Unicode, Instance, Type,
    observe, default, validate
)
from warnings import warn


#-----------------------------------------------------------------------------
# Functions and classes
#-----------------------------------------------------------------------------

class ZMQDisplayPublisher(DisplayPublisher):
    """A display publisher that publishes data using a ZeroMQ PUB socket."""

    session = Instance(Session, allow_none=True)
    pub_socket = Any(allow_none=True)
    parent_header = Dict({})
    topic = CBytes(b'display_data')

    # thread_local:
    # An attribute used to ensure the correct output message
    # is processed. See dfkernel Issue 113 for a discussion.
    _thread_local = Any()

    def set_parent(self, parent):
        """Set the parent for outbound messages."""
        self.parent_header = extract_header(parent)

    def _flush_streams(self):
        """flush IO Streams prior to display"""
        sys.stdout.flush()
        sys.stderr.flush()

    @default('_thread_local')
    def _default_thread_local(self):
        """Initialize our thread local storage"""
        return local()

    @property
    def _hooks(self):
        if not hasattr(self._thread_local, 'hooks'):
            # create new list for a new thread
            self._thread_local.hooks = []
        return self._thread_local.hooks

    def publish(self, data, metadata=None, source=None, transient=None,
        update=False,
    ):
        """Publish a display-data message

        Parameters
        ----------
        data: dict
            A mime-bundle dict, keyed by mime-type.
        metadata: dict, optional
            Metadata associated with the data.
        transient: dict, optional, keyword-only
            Transient data that may only be relevant during a live display,
            such as display_id.
            Transient data should not be persisted to documents.
        update: bool, optional, keyword-only
            If True, send an update_display_data message instead of display_data.
        """
        self._flush_streams()
        if metadata is None:
            metadata = {}
        if transient is None:
            transient = {}
        self._validate_data(data, metadata)
        content = {}
        content['data'] = encode_images(data)
        content['metadata'] = metadata
        content['transient'] = transient
        content['execution_count'] = self.get_execution_count()

        msg_type = 'update_display_data' if update else 'display_data'

        # Use 2-stage process to send a message,
        # in order to put it through the transform
        # hooks before potentially sending.
        msg = self.session.msg(
            msg_type, json_clean(content),
            parent=self.parent_header
        )

        # Each transform either returns a new
        # message or None. If None is returned,
        # the message has been 'used' and we return.
        for hook in self._hooks:
            msg = hook(msg)
            if msg is None:
                return

        self.session.send(
            self.pub_socket, msg, ident=self.topic,
        )

    def clear_output(self, wait=False):
        """Clear output associated with the current execution (cell).

        Parameters
        ----------
        wait: bool (default: False)
            If True, the output will not be cleared immediately,
            instead waiting for the next display before clearing.
            This reduces bounce during repeated clear & display loops.

        """
        content = dict(wait=wait)
        self._flush_streams()
        self.session.send(
            self.pub_socket, u'clear_output', content,
            parent=self.parent_header, ident=self.topic,
        )

    def register_hook(self, hook):
        """
        Registers a hook with the thread-local storage.

        Parameters
        ----------
        hook : Any callable object

        Returns
        -------
        Either a publishable message, or `None`.

        The DisplayHook objects must return a message from
        the __call__ method if they still require the
        `session.send` method to be called after tranformation.
        Returning `None` will halt that execution path, and
        session.send will not be called.
        """
        self._hooks.append(hook)

    def unregister_hook(self, hook):
        """
        Un-registers a hook with the thread-local storage.

        Parameters
        ----------
        hook: Any callable object which has previously been
              registered as a hook.

        Returns
        -------
        bool - `True` if the hook was removed, `False` if it wasn't
               found.
        """
        try:
            self._hooks.remove(hook)
            return True
        except ValueError:
            return False

class DataflowHistoryManager(object):
    def __init__(self, shell, **kwargs):
        self.shell = shell
        self.flags = dict(kwargs)
        # self.flags['silent'] = True
        self.clear()

    def update_flags(self, **kwargs):
        self.flags.update(kwargs)
        # self.flags['silent'] = True

    def update_code(self, key, code):
        # print("CALLING UPDATE CODE", key)
        if key not in self.code_cache or self.code_cache[key] != code:
            self.code_cache[key] = code
            self.code_stale[key] = True
            self.func_cached[key] = False

    def update_codes(self, code_dict):
        for k, v in code_dict.items():
            self.update_code(k, v)

    def set_stale(self, key):
        self.code_stale[key] = True

    def set_not_stale(self, key):
        self.code_stale[key] = False

    def is_stale(self, key):
        return (key in self.code_stale and self.code_stale[key])

    def update_value(self, key, value):
        self.value_cache[key] = value
        self.last_calculated[key] = self.last_calculated_ctr
        self.last_calculated_ctr += 1

    def sorted_keys(self):
        return (k2 for (v2,k2) in sorted((v,k) for (k,v) in self.last_calculated.items()))

    def clear(self):
        self.func_cached = {}
        self.code_cache = {}
        self.code_stale = {}
        self.value_cache = {}
        self.last_calculated = {}
        # dependencies are a DAG
        self.dep_parents = defaultdict(set) # child -> list(parent)
        self.dep_children = defaultdict(set) # parent -> list(child)
        self.last_calculated_ctr = 0

    def update_dependencies(self, parent, child):
        self.dep_parents[child].add(parent)
        self.dep_children[parent].add(child)

    # returns True if any upstream cell has changed
    def check_upstream(self, k):
        res = False
        for cid in self.dep_parents[k]:
            if self.check_upstream(cid):
                res = True
        if self.is_stale(k) or k not in self.value_cache:
            res = True
        if res:
            self.set_stale(k)
        # print("CHECK UPSTREAM:", k, res)
        return res

    def all_upstream(self, k):
        visited = set()
        res = []
        frontier = list(self.dep_parents[k])
        while len(frontier) > 0:
            cid = frontier.pop(0)
            visited.add(cid)
            res.append(cid)
            for pid in self.dep_parents[cid]:
                if pid not in visited:
                    frontier.append(pid)
        return res

    def all_downstream(self, k):
        visited = set()
        res = []
        frontier = list(self.dep_children[k])
        while len(frontier) > 0:
            cid = frontier.pop(0)
            visited.add(cid)
            res.append(cid)
            for pid in self.dep_children[cid]:
                if pid not in visited:
                    frontier.append(pid)
        return res

    def get_downstream(self, k):
        return list(self.dep_children[k])

    def get_upstream(self, k):
        return list(self.dep_parents[k])

    def update_downstream(self, k):
        # this recurses via run_cell which checks for the update_downstream_deps
        # flag at the end of its run
        for uid in self.dep_children[k]:
            parent_uuid = k
            retval = self.shell.run_cell_as_execute_request(self.code_cache[uid], uid,
                                         **self.flags)
            if not retval.success:
                # FIXME really want to just raise this error and not the bits of the
                # stack that are internal (get_item, etc.)
                retval.raise_error()
            # FIXME can we just rely on run_cell?
            self.shell.uuid = parent_uuid

    def execute_cell(self, k, **flags):
        local_flags = dict(self.flags)
        local_flags.update(flags)
        # print("LOCAL FLAGS:", local_flags)
        child_uuid = self.shell.uuid
        retval = self.shell.run_cell_as_execute_request(self.code_cache[k], k,
                                     **local_flags)
        if not retval.success:
            # FIXME really want to just raise this error and not the bits of the
            # stack that are internal (get_item, etc.)
            retval.raise_error()
        # FIXME can we just rely on run_cell?
        self.shell.uuid = child_uuid
        return retval.result

    def __getitem__(self, k):
        # print("CALLING OUT[{}]".format(k))
        if k not in self.code_stale:
            # print("  KEY ERROR")
            raise KeyError(k)

        # need to update regardless of whether we have value cached
        self.update_dependencies(k, self.shell.uuid)
        # check all upstream to see if something has changed
        if not self.check_upstream(k):
            # print("  VALUE CACHE")
            return self.value_cache[k]
        else:
            # need to re-execute
            # print("  RE-EXECUTE")
            return self.execute_cell(k)


    def __setitem__(self, key, value):
        self.update_value(key, value)

    def get(self, k, d=None):
        try:
            return self.__getitem__(self, k)
        except KeyError:
            return d

    def __len__(self):
        return len(self.code_cache)

    def __iter__(self):
        return self.code_cache.__iter__()

class DataflowFunction(object):
    def __init__(self, df_f_manager, cell_uuid):
        self.df_f_manager = df_f_manager
        self.cell_uuid = cell_uuid

    def __call__(self, *args, **kwargs):
        # print("CALLING AS FUNCTION!", self.cell_uuid)
        return self.df_f_manager.run_as_function(self.cell_uuid, *args, **kwargs)

class DataflowFunctionManager(object):
    def __init__(self, df_hist_manager):
        self.df_hist_manager = df_hist_manager
        self.clear()

    def clear(self):
        self.cell_ivars = {}
        self.cell_ovars = {}

    def set_cell_ivars(self, uid, ivars):
        self.cell_ivars[uid] = [x.strip() for x in ivars.split(',')]

    def set_cell_ovars(self, uid, ovars):
        self.cell_ovars[uid] = [x.strip() for x in ovars.split(',')]

    def __getitem__(self, k):
        # need to pass vars through to function
        return DataflowFunction(self, k)

    def set_function_body(self, uid, code):
        self.df_hist_manager.code_cache[uid] = code
        self.df_hist_manager.func_cached[uid] = True

    def run_as_function(self, uuid, *args, **kwargs):
        # FIXME use kwargs
        if (uuid not in self.df_hist_manager.func_cached or
                not self.df_hist_manager.func_cached[uuid]):
            # run cell magic
            # print("RUNNING CELL MAGIC")
            self.df_hist_manager.execute_cell(uuid)

        local_args = set()
        for (arg_name, arg) in zip(self.cell_ivars[uuid], args):
            # print("SETTING ARG:", arg_name, arg)
            local_args.add(arg_name)
            self.df_hist_manager.shell.user_ns[arg_name] = arg
        # print("==== USER NS BEFORE ====")
        # for k,v in self.df_hist_manager.shell.user_ns.items():
        #     print(' ', k, ':', v)
        # print("==== USER NS DONE ====")
        retval = self.df_hist_manager.execute_cell(uuid)
        # print("RESULT", retval)
        # print("USER NS:")
        # for k,v in self.df_hist_manager.shell.user_ns.items():
        #     print(' ', k, ':', v)

        # FIXME need to replace variables temporarily and add back
        # or just eliminate this by eliminating globals across cells
        res = {}
        for arg_name in self.cell_ovars[uuid]:
            if arg_name in self.df_hist_manager.shell.user_ns:
                res[arg_name] = self.df_hist_manager.shell.user_ns[arg_name]

        # print("RESULTS:", res)
        if len(self.cell_ovars[uuid]) > 1:
            res_cls = namedtuple('Result', self.cell_ovars[uuid])
            return res_cls(**res)
        elif len(self.cell_ovars[uuid]) > 0:
            return next(iter(res.values()))
        else:
            return retval

@magics_class
class FunctionMagics(Magics):
    @cell_magic
    def func(self, line, cell):
        #FIXME better argument parsing (-i and -o, intelligent split)
        arr = line.split('-o')
        self.shell.dataflow_function_manager.set_cell_ivars(self.shell.uuid,
                                                            arr[0])
        if len(arr) > 1:
            self.shell.dataflow_function_manager.set_cell_ovars(self.shell.uuid,
                                                                arr[1])
        self.shell.dataflow_function_manager.set_function_body(self.shell.uuid,
                                                               cell)

@magics_class
class KernelMagics(Magics):
    #------------------------------------------------------------------------
    # Magic overrides
    #------------------------------------------------------------------------
    # Once the base class stops inheriting from magic, this code needs to be
    # moved into a separate machinery as well.  For now, at least isolate here
    # the magics which this class needs to implement differently from the base
    # class, or that are unique to it.

    _find_edit_target = CodeMagics._find_edit_target

    @line_magic
    def edit(self, parameter_s='', last_call=['','']):
        """Bring up an editor and execute the resulting code.

        Usage:
          %edit [options] [args]

        %edit runs an external text editor. You will need to set the command for
        this editor via the ``TerminalInteractiveShell.editor`` option in your
        configuration file before it will work.

        This command allows you to conveniently edit multi-line code right in
        your IPython session.

        If called without arguments, %edit opens up an empty editor with a
        temporary file and will execute the contents of this file when you
        close it (don't forget to save it!).

        Options:

        -n <number>
          Open the editor at a specified line number. By default, the IPython
          editor hook uses the unix syntax 'editor +N filename', but you can
          configure this by providing your own modified hook if your favorite
          editor supports line-number specifications with a different syntax.

        -p
          Call the editor with the same data as the previous time it was used,
          regardless of how long ago (in your current session) it was.

        -r
          Use 'raw' input. This option only applies to input taken from the
          user's history.  By default, the 'processed' history is used, so that
          magics are loaded in their transformed version to valid Python.  If
          this option is given, the raw input as typed as the command line is
          used instead.  When you exit the editor, it will be executed by
          IPython's own processor.

        Arguments:

        If arguments are given, the following possibilites exist:

        - The arguments are numbers or pairs of colon-separated numbers (like
          1 4:8 9). These are interpreted as lines of previous input to be
          loaded into the editor. The syntax is the same of the %macro command.

        - If the argument doesn't start with a number, it is evaluated as a
          variable and its contents loaded into the editor. You can thus edit
          any string which contains python code (including the result of
          previous edits).

        - If the argument is the name of an object (other than a string),
          IPython will try to locate the file where it was defined and open the
          editor at the point where it is defined. You can use ``%edit function``
          to load an editor exactly at the point where 'function' is defined,
          edit it and have the file be executed automatically.

          If the object is a macro (see %macro for details), this opens up your
          specified editor with a temporary file containing the macro's data.
          Upon exit, the macro is reloaded with the contents of the file.

          Note: opening at an exact line is only supported under Unix, and some
          editors (like kedit and gedit up to Gnome 2.8) do not understand the
          '+NUMBER' parameter necessary for this feature. Good editors like
          (X)Emacs, vi, jed, pico and joe all do.

        - If the argument is not found as a variable, IPython will look for a
          file with that name (adding .py if necessary) and load it into the
          editor. It will execute its contents with execfile() when you exit,
          loading any code in the file into your interactive namespace.

        Unlike in the terminal, this is designed to use a GUI editor, and we do
        not know when it has closed. So the file you edit will not be
        automatically executed or printed.

        Note that %edit is also available through the alias %ed.
        """

        opts,args = self.parse_options(parameter_s, 'prn:')

        try:
            filename, lineno, _ = CodeMagics._find_edit_target(self.shell, args, opts, last_call)
        except MacroToEdit:
            # TODO: Implement macro editing over 2 processes.
            print("Macro editing not yet implemented in 2-process model.")
            return

        # Make sure we send to the client an absolute path, in case the working
        # directory of client and kernel don't match
        filename = os.path.abspath(filename)

        payload = {
            'source' : 'edit_magic',
            'filename' : filename,
            'line_number' : lineno
        }
        self.shell.payload_manager.write_payload(payload)

    # A few magics that are adapted to the specifics of using pexpect and a
    # remote terminal

    @line_magic
    def clear(self, arg_s):
        """Clear the terminal."""
        if os.name == 'posix':
            self.shell.system("clear")
        else:
            self.shell.system("cls")

    if os.name == 'nt':
        # This is the usual name in windows
        cls = line_magic('cls')(clear)

    # Terminal pagers won't work over pexpect, but we do have our own pager

    @line_magic
    def less(self, arg_s):
        """Show a file through the pager.

        Files ending in .py are syntax-highlighted."""
        if not arg_s:
            raise UsageError('Missing filename.')

        if arg_s.endswith('.py'):
            cont = self.shell.pycolorize(openpy.read_py_file(arg_s, skip_encoding_cookie=False))
        else:
            cont = open(arg_s).read()
        page.page(cont)

    more = line_magic('more')(less)

    # Man calls a pager, so we also need to redefine it
    if os.name == 'posix':
        @line_magic
        def man(self, arg_s):
            """Find the man page for the given command and display in pager."""
            page.page(self.shell.getoutput('man %s | col -b' % arg_s,
                                           split=False))

    @line_magic
    def connect_info(self, arg_s):
        """Print information for connecting other clients to this kernel

        It will print the contents of this session's connection file, as well as
        shortcuts for local clients.

        In the simplest case, when called from the most recently launched kernel,
        secondary clients can be connected, simply with:

        $> jupyter <app> --existing

        """

        try:
            connection_file = get_connection_file()
            info = get_connection_info(unpack=False)
        except Exception as e:
            warnings.warn("Could not get connection info: %r" % e)
            return

        # if it's in the default dir, truncate to basename
        if jupyter_runtime_dir() == os.path.dirname(connection_file):
            connection_file = os.path.basename(connection_file)


        print (info + '\n')
        print ("Paste the above JSON into a file, and connect with:\n"
            "    $> jupyter <app> --existing <file>\n"
            "or, if you are local, you can connect with just:\n"
            "    $> jupyter <app> --existing {0}\n"
            "or even just:\n"
            "    $> jupyter <app> --existing\n"
            "if this is the most recent Jupyter kernel you have started.".format(
            connection_file
            )
        )

    @line_magic
    def qtconsole(self, arg_s):
        """Open a qtconsole connected to this kernel.

        Useful for connecting a qtconsole to running notebooks, for better
        debugging.
        """

        # %qtconsole should imply bind_kernel for engines:
        # FIXME: move to ipyparallel Kernel subclass
        if 'ipyparallel' in sys.modules:
            from ipyparallel import bind_kernel
            bind_kernel()

        try:
            connect_qtconsole(argv=arg_split(arg_s, os.name=='posix'))
        except Exception as e:
            warnings.warn("Could not start qtconsole: %r" % e)
            return

    @line_magic
    def autosave(self, arg_s):
        """Set the autosave interval in the notebook (in seconds).

        The default value is 120, or two minutes.
        ``%autosave 0`` will disable autosave.

        This magic only has an effect when called from the notebook interface.
        It has no effect when called in a startup file.
        """

        try:
            interval = int(arg_s)
        except ValueError:
            raise UsageError("%%autosave requires an integer, got %r" % arg_s)

        # javascript wants milliseconds
        milliseconds = 1000 * interval
        display(Javascript("IPython.notebook.set_autosave_interval(%i)" % milliseconds),
            include=['application/javascript']
        )
        if interval:
            print("Autosaving every %i seconds" % interval)
        else:
            print("Autosave disabled")


class ZMQInteractiveShell(InteractiveShell):
    """A subclass of InteractiveShell for ZMQ."""

    displayhook_class = Type(ZMQShellDisplayHook)
    display_pub_class = Type(ZMQDisplayPublisher)
    data_pub_class = Type('dfkernel.datapub.ZMQDataPublisher')
    kernel = Any()
    parent_header = Any()

    @default('banner1')
    def _default_banner1(self):
        return default_banner

    execution_count = Integer(0)
    # Random UUID passed from notebook interface
    # FIXME use an Integer?
    uuid = Integer()
    #uuid = Unicode(None, allow_none=True)
    # Override the traitlet in the parent class, because there's no point using
    # readline for the kernel. Can be removed when the readline code is moved
    # to the terminal frontend.
    colors_force = CBool(True)
    readline_use = CBool(False)
    # autoindent has no meaning in a zmqshell, and attempting to enable it
    # will print a warning in the absence of readline.
    autoindent = CBool(False)
    dataflow_history_manager = Instance(DataflowHistoryManager)
    dataflow_function_manager = Instance(DataflowFunctionManager)
    exiter = Instance(ZMQExitAutocall)

    @default('exiter')
    def _default_exiter(self):
        return ZMQExitAutocall(self)

    @observe('exit_now')
    def _update_exit_now(self, change):
        """stop eventloop when exit_now fires"""
        if change['new']:
            loop = ioloop.IOLoop.instance()
            loop.add_timeout(time.time() + 0.1, loop.stop)

    keepkernel_on_exit = None

    # Over ZeroMQ, GUI control isn't done with PyOS_InputHook as there is no
    # interactive input being read; we provide event loop support in ipkernel
    def enable_gui(self, gui):
        from ipykernel.eventloops import enable_gui as real_enable_gui
        try:
            real_enable_gui(gui)
            self.active_eventloop = gui
        except ValueError as e:
            raise UsageError("%s" % e)

    def init_environment(self):
        """Configure the user's environment."""
        env = os.environ
        # These two ensure 'ls' produces nice coloring on BSD-derived systems
        env['TERM'] = 'xterm-color'
        env['CLICOLOR'] = '1'
        # Since normal pagers don't work at all (over pexpect we don't have
        # single-key control of the subprocess), try to disable paging in
        # subprocesses as much as possible.
        env['PAGER'] = 'cat'
        env['GIT_PAGER'] = 'cat'

    def init_hooks(self):
        super(ZMQInteractiveShell, self).init_hooks()
        self.set_hook('show_in_pager', page.as_hook(payloadpage.page), 99)

    def init_data_pub(self):
        """Delay datapub init until request, for deprecation warnings"""
        pass

    @property
    def data_pub(self):
        if not hasattr(self, '_data_pub'):
            warnings.warn("InteractiveShell.data_pub is deprecated outside IPython parallel.",
                DeprecationWarning, stacklevel=2)

            self._data_pub = self.data_pub_class(parent=self)
            self._data_pub.session = self.display_pub.session
            self._data_pub.pub_socket = self.display_pub.pub_socket
        return self._data_pub

    @data_pub.setter
    def data_pub(self, pub):
        self._data_pub = pub

    def ask_exit(self):
        """Engage the exit actions."""
        self.exit_now = (not self.keepkernel_on_exit)
        payload = dict(
            source='ask_exit',
            keepkernel=self.keepkernel_on_exit,
            )
        self.payload_manager.write_payload(payload)

    def run_cell_as_execute_request(self, code, uuid, store_history=False, silent=False,
                                    shell_futures=True, update_downstream_deps=False):
        return self.kernel.inner_execute_request(code, uuid, silent, store_history)

    def run_cell(self, code, uuid, *args, **kwargs):
        self._last_traceback = None
        return super(ZMQInteractiveShell, self).run_cell(code, uuid, *args, **kwargs)

    def _showtraceback(self, etype, evalue, stb):
        # try to preserve ordering of tracebacks and print statements
        sys.stdout.flush()
        sys.stderr.flush()

        exc_content = {
            u'traceback' : stb,
            u'ename' : unicode_type(etype.__name__),
            u'evalue' : py3compat.safe_unicode(evalue),
            u'execution_count': self.uuid,
        }

        dh = self.displayhook
        # Send exception info over pub socket for other clients than the caller
        # to pick up
        topic = None
        if dh.topic:
            topic = dh.topic.replace(b'execute_result', b'error')

        exc_msg = dh.session.send(dh.pub_socket, u'error', json_clean(exc_content),
                                  dh.parent_header, ident=topic)

        # FIXME - Once we rely on Python 3, the traceback is stored on the
        # exception object, so we shouldn't need to store it here.
        self._last_traceback = stb

    def set_next_input(self, text, replace=False):
        """Send the specified text to the frontend to be presented at the next
        input cell."""
        payload = dict(
            source='set_next_input',
            text=text,
            replace=replace,
        )
        self.payload_manager.write_payload(payload)

    def set_parent(self, parent):
        """Set the parent header for associating output with its triggering input"""
        self.parent_header = parent
        self.displayhook.set_parent(parent)
        self.display_pub.set_parent(parent)
        if hasattr(self, '_data_pub'):
            self.data_pub.set_parent(parent)
        try:
            sys.stdout.set_parent(parent)
        except AttributeError:
            pass
        try:
            sys.stderr.set_parent(parent)
        except AttributeError:
            pass

    def get_parent(self):
        return self.parent_header

    def init_magics(self):
        super(ZMQInteractiveShell, self).init_magics()
        self.register_magics(KernelMagics, FunctionMagics)
        #self.register_magics(FunctionMagics)
        self.magics_manager.register_alias('ed', 'edit')

    def init_virtualenv(self):
        # Overridden not to do virtualenv detection, because it's probably
        # not appropriate in a kernel. To use a kernel in a virtualenv, install
        # it inside the virtualenv.
        # https://ipython.readthedocs.io/en/latest/install/kernel_install.html
        pass

    def _user_obj_error(self):
        """return simple exception dict

        for use in user_expressions
        """

        etype, evalue, tb = self._get_exc_info()
        stb = self.InteractiveTB.get_exception_only(etype, evalue)

        exc_info = {
            u'status': 'error',
            u'traceback': stb,
            u'ename': etype.__name__,
            u'evalue': py3compat.safe_unicode(evalue),
        }

        return exc_info

    # FIXME hack to be notified of change before it happens?
    @validate('uuid')
    def _uuid_to_change(self, proposal):
        # print("UUID TO CHANGE TO", proposal['value'], file=sys.__stdout__)
        if hasattr(sys.stdout, 'get_execution_count'):
            sys.stdout.flush()
        if hasattr(sys.stderr, 'get_execution_count'):
            sys.stderr.flush()
        return proposal['value']

    # FIXME pass shell_futures, update_downstream_deps through
    def run_cell_as_execute_request(self, raw_cell, uuid=None, store_history=False, silent=False,
                                        shell_futures=True, update_downstream_deps=False):
        return self.run_cell(raw_cell, uuid, store_history=store_history, silent=silent)

    def run_cell(self, raw_cell, uuid=None, code_dict={},
                     store_history=False, silent=False, shell_futures=True,
                     update_downstream_deps=False):
        """Run a complete IPython cell.

        Parameters
        ----------
        raw_cell : str
          The code (including IPython code such as %magic functions) to run.
        store_history : bool
          If True, the raw and translated cell will be stored in IPython's
          history. For user code calling back into IPython's machinery, this
          should be set to False.
        silent : bool
          If True, avoid side-effects, such as implicit displayhooks and
          and logging.  silent=True forces store_history=False.
        shell_futures : bool
          If True, the code will share future statements with the interactive
          shell. It will both be affected by previous __future__ imports, and
          any __future__ imports in the code will affect the shell. If False,
          __future__ imports are not shared in either direction.

        Returns
        -------
        result : :class:`ExecutionResult`
        """

        # print("CODE_DICT:", code_dict)
        # print("RUNNING CELL", uuid, raw_cell)
        # print("RUN_CELL USER_NS:", self.user_ns)
        if store_history:
            self.dataflow_history_manager.update_codes(code_dict)
            # also put the current cell into the cache and force recompute
            if uuid not in code_dict:
                self.dataflow_history_manager.update_code(uuid, raw_cell)
            self.dataflow_history_manager.update_flags(
                store_history=store_history,
                silent=silent,
                shell_futures=shell_futures,
                update_downstream_deps=update_downstream_deps)
        result = ExecutionResult()

        if (not raw_cell) or raw_cell.isspace():
            self.last_execution_succeeded = True
            return result

        if silent:
            store_history = False

        if store_history:
            result.execution_count = uuid

        def error_before_exec(value):
            result.error_before_exec = value
            self.last_execution_succeeded = False
            return result

        self.events.trigger('pre_execute')
        if not silent:
            self.events.trigger('pre_run_cell')

        # If any of our input transformation (input_transformer_manager or
        # prefilter_manager) raises an exception, we store it in this variable
        # so that we can display the error after logging the input and storing
        # it in the history.
        preprocessing_exc_tuple = None
        try:
            # Static input transformations
            cell = self.input_transformer_manager.transform_cell(raw_cell)
        except SyntaxError:
            preprocessing_exc_tuple = sys.exc_info()
            cell = raw_cell  # cell has to exist so it can be stored/logged
        else:
            if len(cell.splitlines()) == 1:
                # Dynamic transformations - only applied for single line commands
                with self.builtin_trap:
                    try:
                        # use prefilter_lines to handle trailing newlines
                        # restore trailing newline for ast.parse
                        cell = self.prefilter_manager.prefilter_lines(cell) + '\n'
                    except Exception:
                        # don't allow prefilter errors to crash IPython
                        preprocessing_exc_tuple = sys.exc_info()

        # Store raw and processed history
        if store_history:
            self.execution_count += 1
            # store cur_execution_count because of recursion
            cur_execution_count = self.execution_count
            # print("STORING INPUTS:", self.execution_count)
            self.history_manager.store_inputs(self.execution_count,
                                              cell, raw_cell)
        if not silent:
            self.logger.log(cell, raw_cell)

        # Display the exception if input processing failed.
        if preprocessing_exc_tuple is not None:
            self.showtraceback(preprocessing_exc_tuple)
            # if store_history:
            #     self.execution_count += 1
            return error_before_exec(preprocessing_exc_tuple[2])

        # Our own compiler remembers the __future__ environment. If we want to
        # run code with a separate __future__ environment, use the default
        # compiler
        compiler = self.compile if shell_futures else CachingCompiler()

        with self.builtin_trap:
            # TODO seems that uuid is more appropriate than execution_count here
            cell_name = self.compile.cache(cell, uuid)

            with self.display_trap:
                # Compile to bytecode
                try:
                    code_ast = compiler.ast_parse(cell, filename=cell_name)
                except self.custom_exceptions as e:
                    etype, value, tb = sys.exc_info()
                    self.CustomTB(etype, value, tb)
                    return error_before_exec(e)
                except IndentationError as e:
                    self.showindentationerror()
                    # if store_history:
                    #     self.execution_count += 1
                    return error_before_exec(e)
                except (OverflowError, SyntaxError, ValueError, TypeError,
                        MemoryError) as e:
                    self.showsyntaxerror()
                    # if store_history:
                    #     self.execution_count += 1
                    return error_before_exec(e)

                # Apply AST transformations
                try:
                    code_ast = self.transform_ast(code_ast)
                except InputRejected as e:
                    self.showtraceback()
                    # if store_history:
                    #     self.execution_count += 1
                    return error_before_exec(e)

                # Give the displayhook a reference to our ExecutionResult so it
                # can fill in the output value.

                # displayhook exec_result changed to reflect recursion
                old_result = self.displayhook.exec_result
                self.displayhook.exec_result = result
                old_uuid = self.uuid
                self.uuid = int(uuid,16)

                # Execute the user code
                interactivity = "none" if silent else self.ast_node_interactivity
                has_raised = self.run_ast_nodes(code_ast.body, cell_name,
                                                interactivity=interactivity, compiler=compiler, result=result)

                self.last_execution_succeeded = not has_raised

                # Reset this so later displayed values do not modify the
                # ExecutionResult
                self.displayhook.exec_result = old_result
                self.uuid = old_uuid

                self.events.trigger('post_execute')
                if not silent:
                    self.events.trigger('post_run_cell')

        if not has_raised:
            if store_history:
                # Write output to the database. Does nothing unless
                # history output logging is enabled.
                # print("STORING HISTORY", cur_execution_count)
                self.history_manager.store_output(cur_execution_count)
                # print("STORING UPDATE VALUE:", uuid, result)
                self.dataflow_history_manager.update_value(uuid, result.result)
                self.dataflow_history_manager.set_not_stale(uuid)

                # Each cell is a *single* input, regardless of how many lines it has
                # self.execution_count += 1

            if store_history:
                result.imm_upstream_deps = self.dataflow_history_manager.get_upstream(uuid)
                result.all_upstream_deps = self.dataflow_history_manager.all_upstream(uuid)
                result.imm_downstream_deps = self.dataflow_history_manager.get_downstream(uuid)
                result.all_downstream_deps = self.dataflow_history_manager.all_downstream(uuid)

        return result

    def run_code(self, code_obj, result=None):
        """Execute a code object.

        When an exception occurs, self.showtraceback() is called to display a
        traceback.

        Parameters
        ----------
        code_obj : code object
          A compiled code object, to be executed
        result : ExecutionResult, optional
          An object to store exceptions that occur during execution.

        Returns
        -------
        False : successful execution.
        True : an error occurred.
        """
        # Set our own excepthook in case the user code tries to call it
        # directly, so that the IPython crash handler doesn't get triggered
        old_excepthook, sys.excepthook = sys.excepthook, self.excepthook

        # we save the original sys.excepthook in the instance, in case config
        # code (such as magics) needs access to it.
        self.sys_excepthook = old_excepthook
        outflag = True  # happens in more places, so it's easier as default
        try:
            try:
                self.hooks.pre_run_code_hook()
                # rprint('Running code', repr(code_obj)) # dbg
                exec(code_obj, self.user_global_ns, self.user_ns)
            finally:
                # Reset our crash handler in place
                sys.excepthook = old_excepthook
        except SystemExit as e:
            if result is not None:
                result.error_in_exec = e
            self.showtraceback(exception_only=True)
            warn("To exit: use 'exit', 'quit', or Ctrl-D.", stacklevel=1)
        except self.custom_exceptions:
            etype, value, tb = sys.exc_info()
            if result is not None:
                result.error_in_exec = value
            self.CustomTB(etype, value, tb)
        except:
            if result is not None:
                result.error_in_exec = sys.exc_info()[1]
            self.showtraceback(running_compiled_code=True)
        else:
            outflag = False
        return outflag

    def init_user_ns(self):
        """Initialize all user-visible namespaces to their minimum defaults.

                Certain history lists are also initialized here, as they effectively
                act as user namespaces.

                Notes
                -----
                All data structures here are only filled in, they are NOT reset by this
                method.  If they were not empty before, data will simply be added to
                therm.
                """
        # This function works in two parts: first we put a few things in
        # user_ns, and we sync that contents into user_ns_hidden so that these
        # initial variables aren't shown by %who.  After the sync, we add the
        # rest of what we *do* want the user to see with %who even on a new
        # session (probably nothing, so they really only see their own stuff)

        # The user dict must *always* have a __builtin__ reference to the
        # Python standard __builtin__ namespace,  which must be imported.
        # This is so that certain operations in prompt evaluation can be
        # reliably executed with builtins.  Note that we can NOT use
        # __builtins__ (note the 's'),  because that can either be a dict or a
        # module, and can even mutate at runtime, depending on the context
        # (Python makes no guarantees on it).  In contrast, __builtin__ is
        # always a module object, though it must be explicitly imported.

        # For more details:
        # http://mail.python.org/pipermail/python-dev/2001-April/014068.html
        ns = {}

        # make global variables for user access to the histories
        ns['_ih'] = self.history_manager.input_hist_parsed
        # ns['_oh'] = self.history_manager.output_hist
        ns['_dh'] = self.history_manager.dir_hist
        ns['_oh'] = self.dataflow_history_manager
        ns['_func'] = self.dataflow_function_manager

        # user aliases to input and output histories.  These shouldn't show up
        # in %who, as they can have very large reprs.
        ns['In'] = self.history_manager.input_hist_parsed
        # ns['Out'] = self.history_manager.output_hist
        ns['Out'] = self.dataflow_history_manager
        ns['Func'] = self.dataflow_function_manager

        # Store myself as the public api!!!
        ns['get_ipython'] = self.get_ipython

        ns['exit'] = self.exiter
        ns['quit'] = self.exiter

        # Sync what we've added so far to user_ns_hidden so these aren't seen
        # by %who
        self.user_ns_hidden.update(ns)

        # Anything put into ns now would show up in %who.  Think twice before
        # putting anything here, as we really want %who to show the user their
        # stuff, not our variables.

        # Finally, update the real user's namespace
        self.user_ns.update(ns)

    def init_history(self):
        """Sets up the command history, and starts regular autosaves."""
        self.history_manager = HistoryManager(shell=self, parent=self)
        self.dataflow_history_manager = DataflowHistoryManager(shell=self)
        self.dataflow_function_manager = \
            DataflowFunctionManager(self.dataflow_history_manager)
        self.configurables.append(self.history_manager)

    # def init_magics(self):
    #     from IPython.core import magics as m
    #     self.magics_manager = magic.MagicsManager(shell=self,
    #                                               parent=self,
    #                                               user_magics=m.UserMagics(self))
    #     self.configurables.append(self.magics_manager)
    #
    #     # Expose as public API from the magics manager
    #     self.register_magics = self.magics_manager.register
    #
    #     self.register_magics(m.AutoMagics, m.BasicMagics, m.CodeMagics,
    #                          m.ConfigMagics, m.DisplayMagics, m.ExecutionMagics,
    #                          m.ExtensionMagics, m.HistoryMagics, m.LoggingMagics,
    #                          m.NamespaceMagics, m.OSMagics, m.PylabMagics, m.ScriptMagics,
    #                          m.FunctionMagics,
    #                          )

InteractiveShellABC.register(ZMQInteractiveShell)
