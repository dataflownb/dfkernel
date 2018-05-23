from collections import OrderedDict
import sys
class LinkedResult(OrderedDict):
    __dfhist__ = None
    def __init__(self, __uuid, *args, **kwargs):
        super().__init__(self, *args, **kwargs)
        self.__uuid__ = __uuid
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

# def build_linked_result(ns, uuid, *args, **kwargs):
#     print("KWARGS:", kwargs.keys())
#     if any(ns._is_link(arg) for arg in kwargs):
#         print("GOT ANY")
#         if all(ns._is_link(arg) for arg in kwargs):
#             print("GOT ALL")
#             if len(kwargs) == 1:
#                 return ns[next(iter(kwargs.keys()))]
#             else:
#                 return tuple(ns[k] for k in kwargs.keys()
#         else:
#             print("GOT ANY ELSE")
#             for arg in kwargs:
#                 if ns._is_link(arg):
#                     ns[arg] # raises DuplicateNameError
#     else:
#         return LinkedResult(uuid, *args, **kwargs)

def build_linked_result(__uuid, *args, **kwargs):
    return LinkedResult(__uuid, *args, **kwargs)