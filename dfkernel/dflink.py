from collections import OrderedDict

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
