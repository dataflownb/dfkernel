from collections import OrderedDict
import sys
class LinkedResult(OrderedDict):
    __dfhist__ = None
    def __init__(self, __uuid, __libs,__none_flag, *args, **kwargs):
        diff = set(list(kwargs)) - set(list(__libs))
        if len(diff) <= 1 and not __none_flag:
            for kwarg in diff:
                if(kwargs[kwarg] is None):
                    del kwargs[kwarg]
        super().__init__(self, *args, **kwargs)
        self.__libs__ = __libs
        self.__uuid__ = __uuid

    def get_uuid(self):
        return self.__uuid__

    def __update_deps__(self,item):
        self.__dfhist__.update_semantic_dependencies(self.__uuid__ + item, self.__dfhist__.shell.uuid)
        self.__dfhist__.remove_semantic_dependencies(self.__uuid__, self.__dfhist__.shell.uuid)

    def __getitem__(self, item):
        if isinstance(item,int):
            item = item+len(self.__libs__)
            if len(self.keys()) > item and item >= 0:
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
            return dftuple(self,vals)
        elif len(vals) == 1:
            return vals[0]
        else:
            return None

    def __sethist__(self,hist):
        self.__dfhist__ = hist

class dftuple(tuple):
    def __new__(self,__linked,*args,**kwargs):
        self.__ref__ = __linked
        return super().__new__(self, *args, **kwargs)

    def __getitem__(self, item):
        return self.__ref__.__getitem__(item)

def build_linked_result(__uuid,__libs,__none_flag, *args, **kwargs):
    return LinkedResult(__uuid,__libs,__none_flag, *args, **kwargs)
