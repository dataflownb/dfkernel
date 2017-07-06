"""A ZMQ-based subclass of InteractiveShell.
"""

from __future__ import print_function

from ipykernel.zmqshell import *
import ipykernel.zmqshell

import sys

from IPython.core.interactiveshell import InteractiveShellABC
from IPython.core.interactiveshell import ExecutionResult
from IPython.core.compilerop import CachingCompiler
from IPython.core.magic import magics_class, Magics, cell_magic
from IPython.core.history import HistoryManager
from IPython.core.error import InputRejected
from ipykernel.jsonutil import json_clean, encode_images
from ipython_genutils import py3compat
from ipython_genutils.py3compat import unicode_type
from dfkernel.displayhook import ZMQShellDisplayHook
from traitlets import (
    Integer, Instance, Type, Unicode, validate
)
from warnings import warn

from dfkernel.dataflow import DataflowHistoryManager, DataflowFunctionManager

#-----------------------------------------------------------------------------
# Functions and classes
#-----------------------------------------------------------------------------

class ZMQDisplayPublisher(ipykernel.zmqshell.ZMQDisplayPublisher):
    """A display publisher that publishes data using a ZeroMQ PUB socket."""

    def publish(self, data, metadata=None, source=None, transient=None,
            update=False):
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

@magics_class
class FunctionMagics(Magics):
    @cell_magic
    def func(self, line, cell):
        #FIXME better argument parsing (-i and -o, intelligent split)
        arr = line.split('-o')
        ivars = [v.strip() for v in (arr[0].split(',')
                                     if arr[0].strip() != ""
                                     else [])]
        self.shell.dataflow_function_manager.set_cell_ivars(self.shell.uuid,
                                                            ivars)
        ovars = [v.strip() for v in (arr[1].split(',')
                                     if len(arr) > 1 and arr[1].strip() != ""
                                     else [])]
        self.shell.dataflow_function_manager.set_cell_ovars(self.shell.uuid,
                                                            ovars)
        self.shell.dataflow_function_manager.set_function_body(self.shell.uuid,
                                                               cell)

class ZMQInteractiveShell(ipykernel.zmqshell.ZMQInteractiveShell):
    """A subclass of InteractiveShell for ZMQ."""

    displayhook_class = Type(ZMQShellDisplayHook)
    display_pub_class = Type(ZMQDisplayPublisher)

    execution_count = Integer(0)
    # UUID passed from notebook interface
    uuid = Unicode()
    dataflow_history_manager = Instance(DataflowHistoryManager)
    dataflow_function_manager = Instance(DataflowFunctionManager)


    def run_cell_as_execute_request(self, code, uuid, store_history=False, silent=False,
                                    shell_futures=True, update_downstream_deps=False):
        return self.kernel.inner_execute_request(code, uuid, silent, store_history)

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

    def init_magics(self):
        super(ZMQInteractiveShell, self).init_magics()
        self.register_magics(FunctionMagics)

    # FIXME hack to be notified of change before it happens?
    @validate('uuid')
    def _uuid_to_change(self, proposal):
        # print("UUID TO CHANGE TO", proposal['value'], file=sys.__stdout__)
        if hasattr(sys.stdout, 'get_execution_count'):
            sys.stdout.flush()
        if hasattr(sys.stderr, 'get_execution_count'):
            sys.stderr.flush()
        return proposal['value']

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
        self._last_traceback = None

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
                self.uuid = uuid

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

InteractiveShellABC.register(ZMQInteractiveShell)
