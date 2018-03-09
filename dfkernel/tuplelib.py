#from dfkernel.dataflow import DataflowHistoryManager
import dfkernel.zmqshell


def dftuple(name, ids, id, args=None):
    from collections import namedtuple
    #ids['id'] = id
    #print(dfkernel.dataflow.DataFlowHistoryManager)
    df_tuple = namedtuple(name, ids)
    class AttrListenMixin(object):
        uuid = id
        storedcalls = []
        def __getattribute__(self, item):
            if item in ids:
                self.storedcalls.append({'cell':self.uuid,'namedattribute':item})
                print("CALLED:{}.{}".format(self.uuid,item))
                #print(self.df_hist)
                #print("CALLED:", item)
            return object.__getattribute__(self, item)
        def __clearcalls__(self):
            storedcalls = []
        def __getcalls__(self):
            return self.storedcalls

    return type('dftuple', (AttrListenMixin, df_tuple), {})