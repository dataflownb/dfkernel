from collections import defaultdict, namedtuple, OrderedDict
from dfkernel.dflink import LinkedResult

class DataflowHistoryManager(object):
    storeditems = []
    tup_flag = False

    def __init__(self, shell, **kwargs):
        self.shell = shell
        self.flags = dict(kwargs)
        # self.flags['silent'] = True
        self.clear()

    def update_flags(self, **kwargs):
        self.flags.update(kwargs)
        # self.flags['silent'] = True

    def update_code(self, key, code):
        # print("CALLING UPDATE CODE", key)
        if key not in self.code_cache or self.code_cache[key] != code:
            self.code_cache[key] = code
            self.set_stale(key)
            self.func_cached[key] = False

    def update_codes(self, code_dict):
        for k, v in code_dict.items():
            self.update_code(k, v)

    def set_stale(self, key):
        self.code_stale[key] = True
        # need to make sure everything downstream also gets set to stale
        for cid in self.all_downstream(key):
            self.code_stale[cid] = True

    def set_not_stale(self, key):
        self.code_stale[key] = False

    def is_stale(self, key):
        return (key in self.code_stale and self.code_stale[key])

    def update_value(self, key, value):

        self.value_cache[key] = value
        self.last_calculated[key] = self.last_calculated_ctr
        self.last_calculated_ctr += 1

    def sorted_keys(self):
        return (k2 for (v2,k2) in sorted((v,k) for (k,v) in self.last_calculated.items()))

    def clear(self):
        self.func_cached = {}
        self.code_cache = {}
        self.code_stale = {}
        self.value_cache = {}
        self.last_calculated = {}
        # dependencies are a DAG
        self.dep_parents = defaultdict(set) # child -> list(parent)
        self.dep_children = defaultdict(set) # parent -> list(child)
        self.dep_semantic_children = defaultdict(set)
        self.dep_semantic_parents = defaultdict(set)
        self.last_calculated_ctr = 0

    def update_dependencies(self, parent, child):
        self.storeditems.append({'parent':parent,'child':child})
        self.dep_parents[child].add(parent)
        self.dep_children[parent].add(child)
        self.dep_semantic_parents[child].add(parent)
        self.dep_semantic_children[parent].add(child)

    def update_semantic_dependencies(self,parent,child):
        self.dep_semantic_parents[child].add(parent)
        self.dep_semantic_children[parent].add(child)

    def remove_dependencies(self, parent, child):
        self.remove_dep(parent,child,self.dep_parents,self.dep_children)

    def remove_semantic_dependencies(self, parent, child):
        self.remove_dep(parent,child,self.dep_semantic_parents,self.dep_semantic_children)

    def remove_dep(self,parent,child,parents,children):
        if parent in parents[child]:
            parents[child].remove(parent)
            children[parent].remove(child)

    # returns True if any upstream cell has changed
    def check_upstream(self, k):
        class CyclicalCall(KeyError):
            '''This error results when the call being made is Cyclical'''
        res = False
        for cid in self.dep_parents[k]:
            if(cid in self.dep_children[k]):
                if(cid == k):
                    raise CyclicalCall("Out[" + k + "] results in a Cyclical call")
                    #Should no longer be nessecary
                    #return False
                continue
            if self.check_upstream(cid):
                res = True
        if self.is_stale(k) or k not in self.value_cache:
            res = True
        if res:
            self.set_stale(k)
        # print("CHECK UPSTREAM:", k, res)
        return res

    def all_semantic_upstream(self,k):
        return self.get_all_upstreams(k,self.dep_semantic_parents)

    def all_upstream(self, k):
        return self.get_all_upstreams(k,self.dep_parents)

    def get_all_upstreams(self,k,dep_parents):
        visited = set()
        res = set()
        frontier = list(dep_parents[k[:6]])
        while len(frontier) > 0:
            cid = frontier.pop(0)[:6]
            visited.add(cid)
            res.add(cid)
            for pid in dep_parents[cid]:
                if pid[:6] not in visited:
                    frontier.append(pid[:6])
        return list(res)

    def all_semantic_downstream(self,k):
        return self.get_all_downstream(k,self.dep_semantic_children)

    def all_downstream(self,k):
        return self.get_all_downstream(k,self.dep_children)

    def get_all_downstream(self, k,dep_children):
        visited = set()
        res = []
        frontier = list(dep_children[k])
        while len(frontier) > 0:
            cid = frontier.pop(0)
            visited.add(cid)
            res.append(cid)
            for pid in dep_children[cid]:
                if pid not in visited:
                    frontier.append(pid)
        return res

    def get_downstream(self, k):
        return list(self.dep_children[k])

    def get_upstream(self, k):
        return list(self.dep_parents[k])

    def get_semantic_downstream(self, k):
        return list(self.dep_semantic_children[k])

    def get_semantic_upstream(self, k):
        return list(self.dep_semantic_parents[k])

    def update_downstream(self, k):
        # this recurses via run_cell which checks for the update_downstream_deps
        # flag at the end of its run
        for uid in self.dep_children[k]:
            parent_uuid = k
            retval = self.shell.run_cell_as_execute_request(self.code_cache[uid], uid,
                                         **self.flags)
            if not retval.success:
                # FIXME really want to just raise this error and not the bits of the
                # stack that are internal (get_item, etc.)
                retval.raise_error()
            # FIXME can we just rely on run_cell?
            self.shell.uuid = parent_uuid

    def execute_cell(self, k, **flags):
        local_flags = dict(self.flags)
        local_flags.update(flags)
        # print("LOCAL FLAGS:", local_flags)
        class CyclicalCall(KeyError):
            '''This error results when the call being made is Cyclical'''
        for cid in self.dep_parents[k]:
            if cid in self.dep_children[k]:
                print("zzzz")
                raise CyclicalCall("Out[" + k + "] results in a Cyclical call")
        child_uuid = self.shell.uuid
        retval = self.shell.run_cell_as_execute_request(self.code_cache[k], k,
                                     **local_flags)
        if not retval.success:
            # FIXME really want to just raise this error and not the bits of the
            # stack that are internal (get_item, etc.)
            retval.raise_error()
        # FIXME can we just rely on run_cell?
        self.shell.uuid = child_uuid
        return retval.result


    def __getitem__(self, k):
        res = self._get_item(k)
        if isinstance(res,LinkedResult):
            return res.__tuple__()
        return res


    def stale_check(self,k):
        class InvalidOutCell(KeyError):
            '''Called when an Invalid OutCell is called'''
        if k not in self.code_stale:
            raise InvalidOutCell("Out["+k + "] is an Invalid Out Cell Reference")

    def _get_item(self,k):
        self.stale_check(k)
        self.update_dependencies(k, self.shell.uuid)
        # check if we need to recompute
        if not self.is_stale(k):
            return self.value_cache[k]
        else:
            return self.execute_cell(k)

    def __setitem__(self, key, value):
        class InvalidCellModification(KeyError):
            '''This error results when another cell tries to modify an Out reference'''
        if(key == self.shell.uuid):
            self.update_value(key, value)
        else:
            raise InvalidCellModification("Out[" + key + "] can only be modified by it's own cell")

    #FIXME
    #Does this function do anything?
    def get(self, k, d=None):
        try:
            return self.__getitem__(self, k)
        except KeyError:
            return d

    def __len__(self):
        return len(self.code_cache)

    def __iter__(self):
        return self.code_cache.__iter__()



class DataflowFunction(object):
    def __init__(self, df_f_manager, cell_uuid):
        self.df_f_manager = df_f_manager
        self.cell_uuid = cell_uuid

    def __call__(self, *args, **kwargs):
        # print("CALLING AS FUNCTION!", self.cell_uuid)
        return self.df_f_manager.run_as_function(self.cell_uuid, *args, **kwargs)

class DataflowFunctionManager(object):
    def __init__(self, df_hist_manager):
        self.df_hist_manager = df_hist_manager
        self.clear()

    def clear(self):
        self.cell_ivars = {}
        self.cell_ovars = {}

    def set_cell_ivars(self, uid, ivars):
        self.cell_ivars[uid] = ivars

    def set_cell_ovars(self, uid, ovars):
        self.cell_ovars[uid] = ovars

    def __getitem__(self, k):
        # need to pass vars through to function
        return DataflowFunction(self, k)

    def set_function_body(self, uid, code):
        self.df_hist_manager.code_cache[uid] = code
        self.df_hist_manager.func_cached[uid] = True

    def run_as_function(self, uuid, *args, **kwargs):
        # FIXME use kwargs
        if (uuid not in self.df_hist_manager.func_cached or
                not self.df_hist_manager.func_cached[uuid]):
            # run cell magic
            # print("RUNNING CELL MAGIC")
            self.df_hist_manager.execute_cell(uuid)

        local_args = set()
        for (arg_name, arg) in zip(self.cell_ivars[uuid], args):
            # print("SETTING ARG:", arg_name, arg)
            local_args.add(arg_name)
            self.df_hist_manager.shell.user_ns[arg_name] = arg
        # print("==== USER NS BEFORE ====")
        # for k,v in self.df_hist_manager.shell.user_ns.items():
        #     print(' ', k, ':', v)
        # print("==== USER NS DONE ====")
        retval = self.df_hist_manager.execute_cell(uuid)
        # print("RESULT", retval)
        # print("USER NS:")
        # for k,v in self.df_hist_manager.shell.user_ns.items():
        #     print(' ', k, ':', v)

        # FIXME need to replace variables temporarily and add back
        # or just eliminate this by eliminating globals across cells
        res = {}
        for arg_name in self.cell_ovars[uuid]:
            if arg_name in self.df_hist_manager.shell.user_ns:
                res[arg_name] = self.df_hist_manager.shell.user_ns[arg_name]


        # print("RESULTS:", res)
        if len(self.cell_ovars[uuid]) > 1:
            res_cls = namedtuple('Result', self.cell_ovars[uuid])
            return res_cls(**res)
        elif len(self.cell_ovars[uuid]) > 0:
            return next(iter(res.values()))
        else:
            return retval

class DuplicateNameError(Exception):
    def __init__(self, var_name, cell_id):
        self.var_name = var_name
        self.cell_id = cell_id

    def __str__(self):
        return (f"name '{self.var_name}' has already been defined in In[{self.cell_id}]")

class DataflowNamespace(dict):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.__links__ = {}
        self.__rev_links__ = defaultdict(list)
        self.__do_not_link__ = set()
        self.__local_vars__ = defaultdict(dict)
        self.__cur_uuid__ = None

    # @property
    # def _cur_uuid(self):
    #     return self.__cur_uuid__
    #
    # @_cur_uuid.setter
    # def _cur_uuid(self, uuid):
    #     if self.__cur_uuid__ is not None:
    #         self._stash_local_vars()
    #     self.__cur_uuid__ = uuid

    def __getitem__(self, k):
        # print("__getitem__", k)
        if k not in self.__do_not_link__ and k in self.__links__:
            # print("getting link", k)
            cell_id = self.__links__[k]
            rev_links = self.__rev_links__[cell_id]
            # FIXME think about local variables...
            # FIXME do we need to compute difference first?
            self.__do_not_link__.update(rev_links)
            df_history = super().__getitem__('_oh')
            # print("Executing cell", cell_id)
            res = df_history._get_item(cell_id)
            # print("Got result", res)
            self.__do_not_link__.difference_update(rev_links)
            return res[k]
        return super().__getitem__(k)



        # if k in self.links:
        #     # run the cell at self.links[k]
        #     pass
        # if k in self:
        #     return super().__getitem__(k)

    def __setitem__(self, k, v):
        # FIXME question is whether to do this or allow local vars
        if k not in self.__do_not_link__ and k in self.__links__:
            raise DuplicateNameError(k, self.__links__[k])
        self.__local_vars__[self.__cur_uuid__][k] = v
        return super().__setitem__(k, v)

    def _add_links(self, tag_dict):
        for (cell_id,tag_list) in tag_dict.items():
            for tag in tag_list:
                self._add_link(tag, cell_id)

    def _add_link(self, name, cell_id):
        if name in self.__links__:
            if self.__links__[name] != cell_id:
                raise DuplicateNameError(name, self.__links__[name])
        else:
            self.__links__[name] = cell_id
            self.__rev_links__[cell_id].append(name)

    def _reset_cell(self, cell_id):
        for name in self.__rev_links__[cell_id]:
            del self.__links__[name]
        del self.__rev_links__[cell_id]

    def _purge_local_vars(self):
        for k in list(self.__local_vars__[self.__cur_uuid__].keys()):
            del self.__local_vars__[self.__cur_uuid__][k]
            del self[k]

    def _stash_local_vars(self):
        if self.__cur_uuid__ is not None:
            for k, v in self.__local_vars__[self.__cur_uuid__].items():
                del self[k]

    def _unstash_local_vars(self):
        if self.__cur_uuid__ is not None:
            for k, v in self.__local_vars__[self.__cur_uuid__].items():
                # have to watch for variables that have been added by other cells
                if k not in self.__do_not_link__ and k in self.__links__:
                    raise DuplicateNameError(k, self.__links__[k])
                super().__setitem__(k, v)

    def _start_uuid(self, uuid):
        self._stash_local_vars()
        self.__cur_uuid__ = uuid

    def _revisit_uuid(self, old_uuid):
        self._purge_local_vars()
        self.__cur_uuid__ = old_uuid
        self._unstash_local_vars()

    def _is_external_link(self, k, uuid):
        return k in self.__links__ and self.__links__[k] != uuid