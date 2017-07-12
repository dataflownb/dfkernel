"""Replacements for sys.displayhook that publish over ZMQ."""

# Copyright (c) IPython Development Team.
# Distributed under the terms of the Modified BSD License.

import sys

import builtins as builtin_mod
from IPython.core.displayhook import DisplayHook
from ipykernel.jsonutil import encode_images
from ipython_genutils.py3compat import builtin_mod
from traitlets import Instance, Dict, Any
from jupyter_client.session import extract_header, Session
from warnings import warn


class ZMQDisplayHook(object):
    """A simple displayhook that publishes the object's repr over a ZeroMQ
    socket."""
    topic = b'execute_result'

    def __init__(self, session, pub_socket):
        self.session = session
        self.pub_socket = pub_socket
        self.parent_header = {}

    def get_execution_count(self):
        """This method is replaced in kernelapp"""
        return 0

    def __call__(self, obj):
        if obj is None:
            return

        builtin_mod._ = obj
        sys.stdout.flush()
        sys.stderr.flush()
        contents = {u'execution_count': self.get_execution_count(),
                    u'data': {'text/plain': repr(obj)},
                    u'metadata': {}}
        self.session.send(self.pub_socket, u'execute_result', contents,
                          parent=self.parent_header, ident=self.topic)

    def set_parent(self, parent):
        self.parent_header = extract_header(parent)




class ZMQShellDisplayHook(DisplayHook):
    """A displayhook subclass that publishes data using ZeroMQ. This is intended
    to work with an InteractiveShell instance. It sends a dict of different
    representations of the object."""
    topic=None

    session = Instance(Session, allow_none=True)
    pub_socket = Any(allow_none=True)
    parent_header = Dict({})

    def get_execution_count(self):
        raise NotImplementedError()

    def set_parent(self, parent):
        """Set the parent for outbound messages."""
        self.parent_header = extract_header(parent)

    def start_displayhook(self):
        self.msg = self.session.msg(u'execute_result', {
            'data': {},
            'metadata': {},
        }, parent=self.parent_header)

    def write_output_prompt(self):
        """Write the output prompt."""
        self.msg['content']['execution_count'] = hex(self.get_execution_count())[2:]
        self.msg['content']['uuid'] = self.get_execution_count()

    def write_format_data(self, format_dict, md_dict=None):
        self.msg['content']['data'] = encode_images(format_dict)
        self.msg['content']['metadata'] = md_dict

    def finish_displayhook(self):
        """Finish up all displayhook activities."""
        sys.stdout.flush()
        sys.stderr.flush()
        if self.msg['content']['data']:
            self.session.send(self.pub_socket, self.msg, ident=self.topic)
        self.msg = None

    @property
    def prompt_count(self):
            return self.shell.uuid

    def cull_cache(self):
        """Output cache is full, cull the oldest entries"""
        oh = self.shell.user_ns.get('_oh', {})
        sz = len(oh)
        cull_count = max(int(sz * self.cull_fraction), 2)
        warn('Output cache limit (currently {sz} entries) hit.\n'
             'Flushing oldest {cull_count} entries.'.format(sz=sz, cull_count=cull_count))

        for i, uid in enumerate(oh.sorted_keys()):
            if i >= cull_count:
                break
            self.shell.user_ns.pop('_%s' % uid, None)
            oh.pop(uid, None)

    def flush(self):
        if not self.do_full_cache:
            raise ValueError("You shouldn't have reached the cache flush "
                             "if full caching is not enabled!")

        # for n in range(1,self.prompt_count + 1):
        #     key = '_'+repr(n)
        #     try:
        #         del self.shell.user_ns[key]
        #     except: pass

        # In some embedded circumstances, the user_ns doesn't have the
        # '_oh' key set up.
        oh = self.shell.user_ns.get('_oh', None)
        if oh is not None:
            # delete auto-generated vars from global namespace
            for uid in oh:
                key = '_' + uid
                try:
                    del self.shell.user_ns[key]
                except:
                    pass

            oh.clear()

        # Release our own references to objects:
        self._, self.__, self.___ = '', '', ''

        if '_' not in builtin_mod.__dict__:
            self.shell.user_ns.update({'_': None, '__': None, '___': None})
        import gc
        # TODO: Is this really needed?
        # IronPython blocks here forever
        if sys.platform != "cli":
            gc.collect()
