import ipykernel.ipkernel
from ipykernel.ipkernel import *

"""The IPython kernel implementation"""

import sys
import time

from ipython_genutils.py3compat import safe_unicode
from traitlets import Type
from ipython_genutils import py3compat
from ipython_genutils.py3compat import unicode_type
from ipykernel.jsonutil import json_clean

from .zmqshell import ZMQInteractiveShell

class IPythonKernel(ipykernel.ipkernel.IPythonKernel):
    shell_class = Type(ZMQInteractiveShell)
    execution_count = None


    def __init__(self, **kwargs):
        super(IPythonKernel, self).__init__(**kwargs)
        self.shell.displayhook.get_execution_count = lambda: self.execution_count
        self.shell.display_pub.get_execution_count = lambda: self.execution_count

    @property
    def execution_count(self):
        # return self.shell.execution_count
        return self.shell.uuid

    @execution_count.setter
    def execution_count(self, value):
        # Ignore the incrememnting done by KernelBase, in favour of our shell's
        # execution counter.
        pass

    def execute_request(self, stream, ident, parent):
        """handle an execute_request"""

        try:
            content = parent[u'content']
            code = py3compat.cast_unicode_py2(content[u'code'])
            silent = content[u'silent']
            store_history = content.get(u'store_history', not silent)
            user_expressions = content.get('user_expressions', {})
            allow_stdin = content.get('allow_stdin', False)
        except:
            self.log.error("Got bad msg: ")
            self.log.error("%s", parent)
            return

        stop_on_error = content.get('stop_on_error', True)

        # grab and remove uuid from user_expressions
        # there just for convenience of not modifying the msg protocol
        uuid = user_expressions.pop('__uuid__', None)
        code_dict = user_expressions.pop('__code_dict__', dict())

        self._outer_stream = stream
        self._outer_ident = ident
        self._outer_parent = parent
        self._outer_stop_on_error = stop_on_error
        self._outer_allow_stdin = allow_stdin
        self._outer_code_dict = code_dict # stash since will be global

        self.inner_execute_request(code, uuid, silent,
                                   store_history, user_expressions)

        self._outer_stream = None
        self._outer_ident = None
        self._outer_parent = None
        self._outer_stop_on_error = None
        self._outer_allow_stdin = None
        self._outer_code_dict = None

    def inner_execute_request(self, code, uuid, silent,
                              store_history=True, user_expressions=None):

        stream = self._outer_stream
        ident = self._outer_ident
        parent = self._outer_parent
        stop_on_error = self._outer_stop_on_error
        allow_stdin = self._outer_allow_stdin
        code_dict = self._outer_code_dict

        # FIXME does it make sense to reparent a request?
        metadata = self.init_metadata(parent)

        if not silent:
            self._publish_execute_input(code, parent, uuid)

        reply_content, res = self.do_execute(code, uuid, code_dict, silent, store_history,
                                        user_expressions, allow_stdin)

        # Flush output before sending the reply.
        sys.stdout.flush()
        sys.stderr.flush()
        # FIXME: on rare occasions, the flush doesn't seem to make it to the
        # clients... This seems to mitigate the problem, but we definitely need
        # to better understand what's going on.
        if self._execute_sleep:
            time.sleep(self._execute_sleep)

        # Send the reply.
        reply_content = json_clean(reply_content)
        metadata = self.finish_metadata(parent, metadata, reply_content)

        reply_msg = self.session.send(stream, u'execute_reply',
                                      reply_content, parent, metadata=metadata,
                                      ident=ident)

        self.log.debug("%s", reply_msg)

        if not silent and reply_msg['content']['status'] == u'error' and stop_on_error:
            self._abort_queues()

        return res

    def do_execute(self, code, uuid, code_dict, silent, store_history=True,
                   user_expressions=None, allow_stdin=False):
        shell = self.shell # we'll need this a lot here

        self._forward_input(allow_stdin)

        reply_content = {}

        res = None
        try:
            res = shell.run_cell(code, uuid=uuid, code_dict=code_dict,
                                 store_history=store_history, silent=silent)
        finally:
            self._restore_input()

        if res.error_before_exec is not None:
            err = res.error_before_exec
        else:
            err = res.error_in_exec

        if res.success:
            print("SETTING DEPS", res.all_upstream_deps, res.all_downstream_deps,file=sys.__stdout__)
            reply_content[u'status'] = u'ok'
            reply_content[u'upstream_deps'] = res.all_upstream_deps
            reply_content[u'downstream_deps'] = res.all_downstream_deps
            reply_content[u'imm_upstream_deps'] = res.imm_upstream_deps
            reply_content[u'imm_downstream_deps'] = res.imm_downstream_deps
        else:
            reply_content[u'status'] = u'error'

            reply_content.update({
                u'traceback': shell._last_traceback or [],
                u'ename': unicode_type(type(err).__name__),
                u'evalue': safe_unicode(err),
            })

            # FIXME: deprecated piece for ipyparallel (remove in 5.0):
            e_info = dict(engine_uuid=self.ident, engine_id=self.int_id,
                          method='execute')
            reply_content['engine_info'] = e_info


        # Return the execution counter so clients can display prompts
        reply_content['execution_count'] = uuid
        # reply_content['execution_count'] = shell.execution_count - 1

        if 'traceback' in reply_content:
            self.log.info("Exception in execute request:\n%s", '\n'.join(reply_content['traceback']))


        # At this point, we can tell whether the main code execution succeeded
        # or not.  If it did, we proceed to evaluate user_expressions
        if reply_content['status'] == 'ok':
            reply_content[u'user_expressions'] = \
                         shell.user_expressions(user_expressions or {})
        else:
            # If there was an error, don't even try to compute expressions
            reply_content[u'user_expressions'] = {}

        # Payloads should be retrieved regardless of outcome, so we can both
        # recover partial output (that could have been generated early in a
        # block, before an error) and always clear the payload system.
        reply_content[u'payload'] = shell.payload_manager.read_payload()
        # Be aggressive about clearing the payload because we don't want
        # it to sit in memory until the next execute_request comes in.
        shell.payload_manager.clear_payload()

        return reply_content, res

# This exists only for backwards compatibility - use IPythonKernel instead
class Kernel(IPythonKernel):
    def __init__(self, *args, **kwargs):
        import warnings
        warnings.warn('Kernel is a deprecated alias of dfkernel.ipkernel.IPythonKernel',
                      DeprecationWarning)
        super(Kernel, self).__init__(*args, **kwargs)
