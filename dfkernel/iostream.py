import ipykernel.iostream
from ipykernel.iostream import *

class OutStream(ipykernel.iostream.OutStream):
    def __init__(self, *args, **kwargs):
        super(OutStream, self).__init__(*args, **kwargs)
        self.execution_count = None

    def get_execution_count(self):
        raise NotImplementedError("Should be added by the kernelapp");

    # Update _flush to send the execution_count back with output
    def _flush(self):
        """This is where the actual send happens.

        _flush should generally be called in the IO thread,
        unless the thread has been destroyed (e.g. forked subprocess).
        """

        self._flush_pending = False
        data = self._flush_buffer()
        if data:
            # FIXME: this disables Session's fork-safe check,
            # since pub_thread is itself fork-safe.
            # There should be a better way to do this.
            self.session.pid = os.getpid()
            content = {u'name': self.name, u'text': data,
                       u'execution_count': self.get_execution_count()}
            self.session.send(self.pub_thread, u'stream', content=content,
                              parent=self.parent_header, ident=self.topic)