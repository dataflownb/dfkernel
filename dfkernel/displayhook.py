"""Replacements for ipykernel.displayhook."""

import ipykernel.displayhook
from ipykernel.displayhook import *

class ZMQShellDisplayHook(ipykernel.displayhook.ZMQShellDisplayHook):
    def get_execution_count(self):
        raise NotImplementedError()

    def write_output_prompt(self):
        """Write the output prompt."""
        self.msg['content']['execution_count'] = self.get_execution_count()

    @property
    def prompt_count(self):
        return self.shell.uuid
