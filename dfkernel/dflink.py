from collections import OrderedDict
import sys
class LinkedResult(OrderedDict):
    def __init__(self, uuid, *args, **kwargs):
        super().__init__(self, *args, **kwargs)
        self.__uuid__ = uuid

    def get_uuid(self):
        return self.__uuid__

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

def build_linked_result(uuid, *args, **kwargs):
    return LinkedResult(uuid, *args, **kwargs)