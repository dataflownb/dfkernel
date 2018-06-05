from collections import OrderedDict
import sys
class LinkedResult(OrderedDict):
    __dfhist__ = None
    def __init__(self, __uuid, __libs, *args, **kwargs):
        for kwarg in list(kwargs):
            if(kwargs[kwarg] is None):
                del kwargs[kwarg]
        super().__init__(self, *args, **kwargs)
        self.__libs__ = __libs
        self.__uuid__ = __uuid

    def get_uuid(self):
        return self.__uuid__

    def __update_deps__(self,item):
        self.__dfhist__.update_dependencies(self.__uuid__ + item, self.__dfhist__.shell.uuid)
        self.__dfhist__.remove_dependencies(self.__uuid__, self.__dfhist__.shell.uuid)

    def __getitem__(self, item):
        #print(self.__uuid__,item)
        if isinstance(item,int) and len(self.keys()) > item and item >= 0:
            item = list(self.keys())[item]
            self.__update_deps__(item)
        elif item in self:
            self.__update_deps__(item)
        return super().__getitem__(item)

    def __tuple__(self):
        vals = []
        for k,v in zip(self.keys(),self.values()):
            if(k not in self.__libs__):
                vals.append(v)
        if len(vals) > 1:
            return tuple(vals)
        elif len(vals) == 1:
            return vals[0]
        else:
            #FIXME: I mean if someone really only has libraries in a cell should we prevent them from accessing a tuple of them?
            return tuple(self.values())

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

def build_linked_result(__uuid,__libs, *args, **kwargs):
    return LinkedResult(__uuid,__libs, *args, **kwargs)