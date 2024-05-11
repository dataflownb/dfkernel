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
        self._subprocess_flush_pending = False

        if self.echo is not None:
            try:
                self.echo.flush()
            except OSError as e:
                if self.echo is not sys.__stderr__:
                    print(f"Flush failed: {e}", file=sys.__stderr__)

        if callable(getattr(self,"_flush_buffers",None)):
            for parent, data in self._flush_buffers():
                # FIXME: this disables Session's fork-safe check,
                # since pub_thread is itself fork-safe.
                # There should be a better way to do this.
                self.session.pid = os.getpid()
                content = {"name": self.name, "text": data,'execution_count': self.get_execution_count()}
                msg = self.session.msg("stream", content, parent=parent)

                # Each transform either returns a new
                # message or None. If None is returned,
                # the message has been 'used' and we return.
                for hook in self._hooks:
                    msg = hook(msg)
                    if msg is None:
                        return

                self.session.send(
                    self.pub_thread,
                    msg,
                    ident=self.topic,
                )

        else:
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
