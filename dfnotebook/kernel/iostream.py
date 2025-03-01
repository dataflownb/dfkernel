import ipykernel.iostream

class OutStream(ipykernel.iostream.OutStream):
    def uuid_hook(self, msg):
        msg['content']['execution_count'] = self.get_execution_count()
        return msg

    def add_uuid_hook(self, get_execution_count):
        self.get_execution_count = get_execution_count
        # this has to be added on the iopubthread...
        # otherwise, _flush will not see it
        self.pub_thread.schedule(self._add_uuid_hook)

    def _add_uuid_hook(self):
        self.register_hook(self.uuid_hook)

    def get_execution_count(self):
        raise NotImplementedError("Should be added by the kernelapp");
