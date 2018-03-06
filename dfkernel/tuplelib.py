def dftuple(name, ids, args=None):
    from collections import namedtuple
    df_tuple = namedtuple(name, ids)

    class AttrListenMixin(object):
        def __getattribute__(self, item):
            if item in ids:
                print("CALLED:{}.{}".format(self,item))
                #print("CALLED:", item)
            return object.__getattribute__(self, item)

    return type('dftuple', (AttrListenMixin, df_tuple), {})