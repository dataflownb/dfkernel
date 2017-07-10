from collections import defaultdict, namedtuple

class DataflowHistoryManager(object):
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
            self.code_stale[key] = True
            self.func_cached[key] = False

    def update_codes(self, code_dict):
        for k, v in code_dict.items():
            self.update_code(k, v)

    def set_stale(self, key):
        self.code_stale[key] = True

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
        self.last_calculated_ctr = 0

    def update_dependencies(self, parent, child):
        self.dep_parents[child].add(parent)
        self.dep_children[parent].add(child)

    # returns True if any upstream cell has changed
    def check_upstream(self, k):
        #print(k, self.dep_parents[k])
        #print(self.dep_children[k])
        res = False
        for cid in self.dep_parents[k]:
            if(cid in self.dep_children[k]):
                if(cid == k):
                    return False
                continue
            if self.check_upstream(cid):
                res = True
        if self.is_stale(k) or k not in self.value_cache:
            res = True
        if res:
            self.set_stale(k)
        # print("CHECK UPSTREAM:", k, res)
        return res

    def all_upstream(self, k):
        visited = set()
        res = []
        frontier = list(self.dep_parents[k])
        while len(frontier) > 0:
            cid = frontier.pop(0)
            visited.add(cid)
            res.append(cid)
            for pid in self.dep_parents[cid]:
                if pid not in visited:
                    frontier.append(pid)
        return res

    def all_downstream(self, k):
        visited = set()
        res = []
        frontier = list(self.dep_children[k])
        while len(frontier) > 0:
            cid = frontier.pop(0)
            visited.add(cid)
            res.append(cid)
            for pid in self.dep_children[cid]:
                if pid not in visited:
                    frontier.append(pid)
        return res

    def get_downstream(self, k):
        return list(self.dep_children[k])

    def get_upstream(self, k):
        return list(self.dep_parents[k])

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
        class InvalidOutCell(KeyError):
            '''Called when an Invalid OutCell is called'''
        # print("CALLING OUT[{}]".format(k))
        if k not in self.code_stale:
            #print("Invalid Key: Out['",k,"'] is an Invalid Cell")
            # print("  KEY ERROR")
            raise InvalidOutCell("Out['"+k + "'] is an Invalid Out Cell Reference")

        # need to update regardless of whether we have value cached
        self.update_dependencies(k, self.shell.uuid)
        # check all upstream to see if something has changed
        if not self.check_upstream(k):
            # print("  VALUE CACHE")
            return self.value_cache[k]
        else:
            # need to re-execute
            # print("  RE-EXECUTE")
            return self.execute_cell(k)


    def __setitem__(self, key, value):
        self.update_value(key, value)

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

