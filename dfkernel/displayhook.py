"""Replacements for ipykernel.displayhook."""

import sys

from ipykernel.displayhook import ZMQShellDisplayHook as ipyZMQShellDisplayHook
from ipykernel.displayhook import ZMQDisplayHook
from ipykernel.jsonutil import encode_images, json_clean

from .dflink import LinkedResult

class ZMQShellDisplayHook(ipyZMQShellDisplayHook):
    def get_execution_count(self):
        raise NotImplementedError()

    def write_output_prompt(self, tag=None):
        self.msg['content']['execution_count'] = self.get_execution_count()

    def write_format_data(self, format_dict, md_dict=None):
        # print("WRITING FORMAT DATA:", format_dict, file=sys.__stdout__)
        if 0 in format_dict:
            # have multiple outputs
            new_format_dict = {}
            for i in format_dict:
                new_format_dict[i] = json_clean(encode_images(format_dict[i]))
            self.msg['content']['data'] = new_format_dict
        else:
            self.msg['content']['data'] = json_clean(encode_images(format_dict))
        self.msg['content']['metadata'] = md_dict

    @property
    def prompt_count(self):
        return self.shell.uuid

    def __call__(self, result=None):
        """Printing with history cache management.

        This is invoked everytime the interpreter needs to print, and is
        activated by setting the variable sys.displayhook to it.
        """
        self.check_for_underscore()
        if result is not None and not self.quiet():
            self.start_displayhook()
            self.write_output_prompt()
            # print("GOT CALL:", result, file=sys.__stdout__)
            if isinstance(result, tuple) and (len(result) == 2) \
                    and isinstance(result[0], LinkedResult):
                # FIXME unify this so that the LinkedResult code isn't repeated in the elif
                self.update_dataflow_ns(result[0])
                format_dict = {}
                md_dict = {}
                i = 0
                for i, (res_tag, res) in enumerate(result[0].items()):
                    res_format_dict, res_md_dict = self.compute_format_data(res)
                    format_dict[i] = res_format_dict
                    res_md_dict['output_tag'] = res_tag
                    md_dict[i] = res_md_dict
                format_dict_normal, md_dict_normal = self.compute_format_data(result[1])
                format_dict[i+1] = format_dict_normal
                md_dict[i+1] = md_dict_normal
            elif isinstance(result, LinkedResult):
                self.update_dataflow_ns(result)
                format_dict = {}
                md_dict = {}
                for i, (res_tag, res) in enumerate(result.items()):
                    res_format_dict, res_md_dict = self.compute_format_data(res)
                    format_dict[i] = res_format_dict
                    res_md_dict['output_tag'] = res_tag
                    md_dict[i] = res_md_dict
            # # ONLY allow LinkedResult to work like this for now
            #
            # elif isinstance(result, tuple):
            #     # compute format for each result
            #     format_dict = {}
            #     md_dict = {}
            #     for i, res in enumerate(result):
            #         res_tag = i
            #         if hasattr(result, '_fields'):
            #             res_tag = result._fields[i]
            #         res_format_dict, res_md_dict = self.compute_format_data(res)
            #         format_dict[i] = res_format_dict
            #         res_md_dict['output_tag'] = res_tag
            #         md_dict[i] = res_md_dict
            # # FIXME better way to check this (factor nameddict out)
            # elif result.__class__.__name__ == "nameddict":
            #     # compute format for each result
            #     format_dict = {}
            #     md_dict = {}
            #     for i, res_tag in enumerate(result._fields):
            #         res = result[res_tag]
            #         res_format_dict, res_md_dict = self.compute_format_data(res)
            #         format_dict[i] = res_format_dict
            #         res_md_dict['output_tag'] = res_tag
            #         md_dict[i] = res_md_dict
            else:
                format_dict, md_dict = self.compute_format_data(result)
            self.update_user_ns(result)
            self.fill_exec_result(result)
            # print("FILLING EXEC RESULT", self.exec_result, file=sys.__stdout__)
            if format_dict:
                self.write_format_data(format_dict, md_dict)
                self.log_output(format_dict)
            self.finish_displayhook()

    def update_dataflow_ns(self, result):
        self.shell.user_ns._reset_cell(result.__uuid__)
        for res_tag in result.keys():
            self.shell.user_ns._add_link(res_tag, result.__uuid__)

    def finish_displayhook(self):
        """Finish up all displayhook activities."""
        sys.stdout.flush()
        sys.stderr.flush()
        if self.msg['content']['data']:
            if 0 in self.msg['content']['data']:
                format_data = self.msg['content']['data']
                md_data = self.msg['content']['metadata']
                for i in format_data:
                    self.msg['content']['data'] = format_data[i]
                    self.msg['content']['metadata'] = md_data[i]
                    # print("SENDING", self.msg, file=sys.__stdout__)
                    self.session.send(self.pub_socket, self.msg, ident=self.topic)
            else:
                # print("SENDING2", self.msg, file=sys.__stdout__)
                self.session.send(self.pub_socket, self.msg, ident=self.topic)
        self.msg = None

    def update_user_ns(self, result):
        """Update user_ns with various things like _, __, _1, etc."""

        # Avoid recursive reference when displaying _oh/Out
        if result is not self.shell.user_ns['_oh']:
            if len(self.shell.user_ns['_oh']) >= self.cache_size and self.do_full_cache:
                self.cull_cache()
