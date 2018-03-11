def dftuple(name, ids, args=None):
    from collections import namedtuple
    df_tuple = namedtuple(name, ids)
    class AttrListenMixin(object):
        _dfhist = None
        _uuid = None
        def __getattribute__(self, item):
            if item in ids:
                self._dfhist.update_dependencies(self._uuid+item, self._dfhist.shell.uuid)
                self._dfhist.remove_dependencies(self._uuid, self._dfhist.shell.uuid)
            return object.__getattribute__(self, item)
        def __sethist__(self,hist):
            self._dfhist = hist
        def __setuuid__(self,uuidref):
            self._uuid = uuidref

    return type('dftuple', (AttrListenMixin, df_tuple), {})