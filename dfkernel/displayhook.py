"""Replacements for ipykernel.displayhook."""

import ipykernel.displayhook
from ipykernel.displayhook import *
from ipykernel.jsonutil import encode_images

class ZMQShellDisplayHook(ipykernel.displayhook.ZMQShellDisplayHook):
    def get_execution_count(self):
        raise NotImplementedError()

    def write_output_prompt(self, tag=None):
        self.msg['content']['execution_count'] = self.get_execution_count()

    def write_format_data(self, format_dict, md_dict=None):
        # print("WRITING FORMAT DATA:", format_dict)
        if 0 in format_dict:
            # have multiple outputs
            new_format_dict = {}
            for i in format_dict:
                new_format_dict[i] = encode_images(format_dict[i])
            self.msg['content']['data'] = new_format_dict
        else:
            self.msg['content']['data'] = encode_images(format_dict)
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
            if isinstance(result, tuple):
                # compute format for each result
                format_dict = {}
                md_dict = {}
                for i, res in enumerate(result):
                    res_tag = i
                    if hasattr(result, '_fields'):
                        res_tag = result._fields[i]
                    res_format_dict, res_md_dict = self.compute_format_data(res)
                    format_dict[i] = res_format_dict
                    res_md_dict['output_tag'] = res_tag
                    md_dict[i] = res_md_dict
            # FIXME better way to check this (factor nameddict out)
            elif result.__class__.__name__ == "nameddict":
                # compute format for each result
                format_dict = {}
                md_dict = {}
                for i, res_tag in enumerate(result._fields):
                    res = result[res_tag]
                    res_format_dict, res_md_dict = self.compute_format_data(res)
                    format_dict[i] = res_format_dict
                    res_md_dict['output_tag'] = res_tag
                    md_dict[i] = res_md_dict
            else:
                format_dict, md_dict = self.compute_format_data(result)
            self.update_user_ns(result)
            self.fill_exec_result(result)
            if format_dict:
                self.write_format_data(format_dict, md_dict)
                self.log_output(format_dict)
            self.finish_displayhook()

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
                    self.session.send(self.pub_socket, self.msg, ident=self.topic)
            else:
                self.session.send(self.pub_socket, self.msg, ident=self.topic)
        self.msg = None
