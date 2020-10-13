import ipykernel.ipkernel
from ipykernel.ipkernel import *

"""The IPython kernel implementation"""

import ast
import sys
import time
from tornado import gen
import nest_asyncio

from ipython_genutils.py3compat import safe_unicode
from traitlets import Type
from ipython_genutils import py3compat
from ipython_genutils.py3compat import unicode_type
from ipykernel.jsonutil import json_clean

try:
    from IPython.core.interactiveshell import _asyncio_runner
except ImportError:
    _asyncio_runner = None

from .zmqshell import ZMQInteractiveShell
from .utils import convert_dollar, convert_dfvar, identifier_replacer, dollar_replacer

class IPythonKernel(ipykernel.ipkernel.IPythonKernel):
    shell_class = Type(ZMQInteractiveShell)
    execution_count = None


    def __init__(self, **kwargs):
        super(IPythonKernel, self).__init__(**kwargs)
        self.shell.displayhook.get_execution_count = lambda: int(self.execution_count, 16)
        self.shell.display_pub.get_execution_count = lambda: int(self.execution_count, 16)
        # first use nest_ayncio for nested async, then add asyncio.Future to tornado
        nest_asyncio.apply()
        # from maartenbreddels: https://github.com/jupyter/nbclient/pull/71/files/a79ae70eeccf1ab8bdd28370cd28f9546bd4f657
        # If tornado is imported, add the patched asyncio.Future to its tuple of acceptable Futures"""
        # original from vaex/asyncio.py
        if 'tornado' in sys.modules:
            import tornado.concurrent
            if asyncio.Future not in tornado.concurrent.FUTURES:
                tornado.concurrent.FUTURES = tornado.concurrent.FUTURES + (
                asyncio.Future,)

    @property
    def execution_count(self):
        # return self.shell.execution_count
        return self.shell.uuid

    @execution_count.setter
    def execution_count(self, value):
        # Ignore the incrememnting done by KernelBase, in favour of our shell's
        # execution counter.
        pass

    def ground_code(self, code, execution_count, input_tags):
        code = convert_dollar(code, identifier_replacer, input_tags)


        class DataflowLinker(ast.NodeVisitor):
            def __init__(self, user_ns):
                self.user_ns = user_ns
                self.stored = set()
                self.updates = []
                super().__init__()

            # need to make sure we visit right side before left!
            # seems to happen by default?
            def visit_Assign(self, node):
                self.visit(node.value)
                for target in node.targets:
                    self.visit(target)

            def visit_Name(self, name):
                import sys
                # FIXME what to do with del?
                if isinstance(name.ctx, ast.Store):
                    # print("STORE", name.id, file=sys.__stdout__)
                    self.stored.add(name.id)
                elif (isinstance(name.ctx, ast.Load) and
                        name.id not in self.stored and
                        self.user_ns._is_external_link(name.id, execution_count)):
                    # figure out where we are and keep track of change
                    # FIXME get_parent needs to get most recently used verison of id
                    cell_id = self.user_ns.get_parent(name.id)
                    self.updates.append((name.end_lineno, name.end_col_offset, name.lineno, name.col_offset, name.id, cell_id))
                    # print("LOAD", name.id, cell_id, file=sys.__stdout__)
                self.generic_visit(name)

        tree = ast.parse(code)
        linker = DataflowLinker(self.shell.user_ns)
        linker.visit(tree)
        code_arr = code.splitlines()
        for end_lineno, end_col_offset, lineno, col_offset, name, cell_id in sorted(linker.updates, reverse=True):
            if lineno != end_lineno:
                raise Exception("Names cannot be split over multiple lines")
            s = code_arr[lineno-1]
            code_arr[lineno-1] = ''.join([s[:col_offset], identifier_replacer(cell_id, name), s[end_col_offset:]])
        code = '\n'.join(code_arr)
        # print("STEP 2:", code)

        code = convert_dfvar(code, dollar_replacer)
        # print("STEP 3:", code)

        return code

    # def _publish_execute_input(self, code, parent, execution_count):
    #     # go through nodes and for each node that exists in self.shell's history
    #     # as a load, change it to a var$ce1 reference
    #     # FIXME deal with scoping
    #
    #     super()._publish_execute_input(code, parent, execution_count)

    # @gen.coroutine
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

        # grab and remove dfkernel_data from user_expressions
        # there just for convenience of not modifying the msg protocol
        dfkernel_data = user_expressions.pop('__dfkernel_data__', {})

        input_tags = dfkernel_data.get('input_tags', {})
        # print("SETTING INPUT TAGS:", input_tags, file=sys.__stdout__)
        self.shell.input_tags = input_tags

        self._outer_stream = stream
        self._outer_ident = ident
        self._outer_parent = parent
        self._outer_stop_on_error = stop_on_error
        self._outer_allow_stdin = allow_stdin
        self._outer_dfkernel_data = dfkernel_data

        res = self.inner_execute_request(
            code, dfkernel_data.get('uuid'), silent, store_history,
            user_expressions,
        )

        # self._outer_stream = None
        # self._outer_ident = None
        # self._outer_parent = None
        # self._outer_stop_on_error = None
        # self._outer_allow_stdin = None
        # self._outer_dfkernel_data = None

    @gen.coroutine
    def inner_execute_request(self, code, uuid, silent,
                              store_history=True, user_expressions=None):

        stream = self._outer_stream
        ident = self._outer_ident
        parent = self._outer_parent
        stop_on_error = self._outer_stop_on_error
        allow_stdin = self._outer_allow_stdin
        dfkernel_data = self._outer_dfkernel_data

        input_tags = dfkernel_data.get('input_tags', {})

        # FIXME does it make sense to reparent a request?
        metadata = self.init_metadata(parent)

        execution_count = int(uuid, 16)
        try:
            code = self.ground_code(code, uuid, input_tags)
        except SyntaxError:
            # ignore this for now, catch it in do_execute
            pass

        if not silent:
            self._publish_execute_input(code, parent, execution_count)

        # convert all tilded code
        try:
            code = convert_dollar(code)
        except SyntaxError:
            # ignore this for now, catch it in do_execute
            pass

        reply_content, res = yield gen.maybe_future(
            self.do_execute(code, uuid, dfkernel_data, silent, store_history,
                                        user_expressions, allow_stdin)
        )

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
            # FIXME here's the problem if I don't do coroutine here...
            yield self._abort_queues()

        return res

    @gen.coroutine
    def do_execute(self, code, uuid, dfkernel_data, silent, store_history=True,
                   user_expressions=None, allow_stdin=False):
        shell = self.shell # we'll need this a lot here

        self._forward_input(allow_stdin)

        # print("DO EXECUTE:", uuid, file=sys.__stdout__)
        reply_content = {}
        if hasattr(shell, 'run_cell_async') and hasattr(shell, 'should_run_async'):
            run_cell = partial(shell.run_cell_async_override, uuid=uuid, dfkernel_data=dfkernel_data)
            should_run_async = shell.should_run_async
        else:
            should_run_async = lambda cell: False
            # older IPython,
            # use blocking run_cell and wrap it in coroutine
            @gen.coroutine
            def run_cell(*args, **kwargs):
                kwargs['uuid'] = uuid
                kwargs['dfkernel_data'] = dfkernel_data
                return shell.run_cell(*args, **kwargs)

        res = None
        try:
            # default case: runner is asyncio and asyncio is already running
            # TODO: this should check every case for "are we inside the runner",
            # not just asyncio
            if (
                _asyncio_runner
                and should_run_async(code)
                and shell.loop_runner is _asyncio_runner
                and asyncio.get_event_loop().is_running()
            ):
                # print("RUNNING CELL ASYNC:", uuid, file=sys.__stdout__)
                coro = run_cell(code, store_history=store_history, silent=silent)
                coro_future = asyncio.ensure_future(coro)

                with self._cancel_on_sigint(coro_future):
                    try:
                        # print("TRYING TO YIELD CORO_FUTURE")
                        res = yield coro_future
                    finally:
                        shell.events.trigger('post_execute')
                        if not silent:
                            shell.events.trigger('post_run_cell', res)
            else:
                # runner isn't already running,
                # make synchronous call,
                # letting shell dispatch to loop runners
                res = shell.run_cell(code, uuid=uuid, dfkernel_data=dfkernel_data,
                                     store_history=store_history, silent=silent)
        finally:
            self._restore_input()

        # print("GOT RES:", res)
        if res.error_before_exec is not None:
            err = res.error_before_exec
        else:
            err = res.error_in_exec

        # print("DELETED CELLS:", res, file=sys.__stdout__)
        reply_content[u'deleted_cells'] = res.deleted_cells

        if res.success:
            # print("SETTING DEPS", res.all_upstream_deps, res.all_downstream_deps,file=sys.__stdout__)
            reply_content[u'status'] = u'ok'
            reply_content[u'nodes'] = res.nodes
            reply_content[u'links'] = res.links
            reply_content[u'cells'] = res.cells

            reply_content[u'upstream_deps'] = res.all_upstream_deps
            reply_content[u'downstream_deps'] = res.all_downstream_deps
            reply_content[u'imm_upstream_deps'] = res.imm_upstream_deps
            reply_content[u'imm_downstream_deps'] = res.imm_downstream_deps
            reply_content[u'update_downstreams'] = res.update_downstreams
            reply_content[u'internal_nodes'] = res.internal_nodes
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
        reply_content['execution_count'] = int(uuid, 16)
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
