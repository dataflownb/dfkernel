from collections import OrderedDict

class LinkedResult(OrderedDict):
    __dfhist__ = None
    def __init__(self, uuid, *args, **kwargs):
        super().__init__(self, *args, **kwargs)
        self.__uuid__ = uuid
        #self.__dfhist__ =

    def get_uuid(self):
        return self.__uuid__

    def __getitem__(self, item):
        #print(self.__uuid__,item)
        if item in self:
             self.__dfhist__.update_dependencies(self.__uuid__+item, self.__dfhist__.shell.uuid)
             self.__dfhist__.remove_dependencies(self.__uuid__, self.__dfhist__.shell.uuid)
        return super().__getitem__(item)
    def __sethist__(self,hist):
        self.__dfhist__ = hist
    # def __setuuid__(self,uuidref):
    #     self._uuid = uuidref

    # def linked_result(uuid, **kwargs):
    # res = OrderedDict(**kwargs)
    # res.__uuid__ = uuid
    # return res

    # # FIXME need to work within the valid identifiers for namedtuple...
    # # if '__uuid__' in kwargs:
    # #     raise ValueError('Cannot name a result "__uuid__"')
    # res = namedtuple('NamedResult', kwargs.keys())(**kwargs)
    # res.__uuid__ = uuid
    # return res