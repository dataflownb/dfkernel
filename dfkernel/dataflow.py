from collections import defaultdict, namedtuple
from collections.abc import KeysView, ItemsView, ValuesView, MutableMapping
from .dflink import LinkedResult
import itertools

class DataflowCacheException(Exception):
    def __init__(self, cid):
        self.cid = cid

    def __str__(self):
        return "Cell '{}' has not yet been computed".format(self.cid)

class DataflowCellException(Exception):
    def __init__(self, cid):
        self.cid = cid

    def __str__(self):
        return "Cell '{}' raised an exception".format(self.cid)

class DataflowHistoryManager(object):
    deleted_cells = []
    storeditems = []
    tup_flag = False

    def __init__(self, shell, **kwargs):
        self.shell = shell
        self.flags = dict(kwargs)
        self.auto_update_flags = {}
        self.force_cached_flags = {}
        # self.flags['silent'] = True
        self.clear()

    def update_flags(self, **kwargs):
        self.flags.update(kwargs)
        # self.flags['silent'] = True

    def update_code(self, key, code):
        # print("CALLING UPDATE CODE", key)
        # if code is empty, remove the code_cache, remove links
        if code == '' and key in self.value_cache:
            self.set_stale(key)
            del self.value_cache[key]
            del self.code_cache[key]
            for child in self.all_downstream(key):
                self.remove_dependencies(key, child)
                self.remove_semantic_dependencies(key, child)
            for parent in self.all_upstream(key):
                self.remove_dependencies(key, parent)
                self.remove_semantic_dependencies(key, parent)
            self.shell.user_ns._reset_cell(key)
            self.deleted_cells.append(key)
            del self.last_calculated[key]
        elif key not in self.code_cache or self.code_cache[key] != code:
            # clear out the old __links__ and __rev_links__ (if exist)
            if self.shell.user_ns.__rev_links__[key]:
                for tag in self.shell.user_ns.__rev_links__[key]:
                    if tag in self.shell.user_ns.__links__:
                        del self.shell.user_ns.__links__[tag]
                del self.shell.user_ns.__rev_links__[key]
            self.func_cached[key] = False
            self.code_cache[key] = code
            self.set_stale(key)
            if key not in self.auto_update_flags:
                self.auto_update_flags[key] = False;
            if key not in self.force_cached_flags:
                self.force_cached_flags[key] = False;

    def update_codes(self, code_dict):
        for key, val in code_dict.items():
            self.update_code(key, val)

    def update_auto_update(self, flags):
        self.auto_update_flags.update(flags)

    def update_force_cached(self, flags):
        self.force_cached_flags.update(flags)

    def set_stale(self, key):
        self.code_stale[key] = True
        # need to make sure everything downstream also gets set to stale
        for cid in self.all_downstream(key):
            self.code_stale[cid] = True

    def set_not_stale(self, key):
        self.code_stale[key] = False

    def is_stale(self, key):
        return key in self.code_stale and self.code_stale[key]

    def update_value(self, key, value):

        self.value_cache[key] = value
        self.last_calculated[key] = self.last_calculated_ctr
        self.last_calculated_ctr += 1

    def sorted_keys(self):
        return (k2 for (v2, k2) in sorted((v, k) for (k, v) in self.last_calculated.items()))

    def clear(self):
        self.func_cached = {}
        self.code_cache = {}
        self.code_stale = {}
        self.value_cache = {}
        self.last_calculated = {}
        # dependencies are a DAG
        self.dep_parents = defaultdict(set) # child -> list(parent)
        self.dep_children = defaultdict(set) # parent -> list(child)
        self.dep_semantic_parents = defaultdict(dict)
        self.last_calculated_ctr = 0

    def update_dependencies(self, parent, child):
        self.storeditems.append({'parent':parent, 'child':child})
        self.dep_parents[child].add(parent)
        self.dep_children[parent].add(child)
        if parent not in self.dep_semantic_parents[child]:
            self.dep_semantic_parents[child][parent] = set([parent])

    def update_semantic_dependencies(self, parent, child,item=None):
        if item:
            self.dep_semantic_parents[child][parent].add(item)

    def remove_dependencies(self, parent, child):
        self.remove_dep(parent, child, self.dep_parents, self.dep_children)

    def remove_semantic_dependencies(self, parent, child,item=None):
        if parent in self.dep_semantic_parents[child]:
            if item:
                self.dep_semantic_parents[child][parent].discard(item)
            else:
                 self.dep_semantic_parents[child][parent].discard(parent)

    @staticmethod
    def remove_dep(parent, child, parents, children):
        if parent in parents[child]:
            parents[child].remove(parent)
            children[parent].remove(child)


    def all_semantic_upstream(self, k):
        return self.get_all_upstreams(k, True)

    def all_upstream(self, k):
        return self.get_all_upstreams(k, False)


    def get_all_upstreams(self, k, semantic=False):
        visited = set()
        res = set(self.get_semantic_upstream(k)) if semantic else set()
        frontier = list(self.dep_parents[k])
        while frontier:
            cid = frontier.pop(0)
            visited.add(cid)
            if semantic:
                res.update(self.get_semantic_upstream(cid))
            else:
                res.add(cid)
            for pid in self.dep_parents[cid]:
                if pid not in visited:
                    frontier.append(pid)
        return list(res)


    def all_downstream(self, k):
        return self.get_all_downstream(k)

    def get_all_downstream(self, k):
        visited = set()
        res = set()
        frontier = list(self.dep_children[k])
        while frontier:
            cid = frontier.pop(0)
            visited.add(cid)
            res.add(cid)
            for pid in self.dep_children[cid]:
                if pid not in visited:
                    frontier.append(pid)
        return list(res)

    def get_downstream(self, k):
        return list(self.dep_children[k])

    def get_upstream(self, k):
        return list(self.dep_parents[k])

    def get_semantic_upstream(self, k):
        semantic_up = []
        for key in self.dep_semantic_parents[k].keys():
            semantic_up += [key+item for item in self.dep_semantic_parents[k][key]]
        return semantic_up

    def raw_semantic_upstream(self,k):
        return self.dep_semantic_parents[k]

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
        for cid in self.dep_parents[k]:
            if cid in self.dep_children[k]:
                raise CyclicalCallError(k)
        child_uuid = self.shell.uuid
        retval = self.shell.run_cell_as_execute_request(self.code_cache[k], k,
                                                   **self.flags)
        # print('retval:', retval)
        if not retval.success:
            raise DataflowCellException(k)
        # FIXME can we just rely on run_cell?
        self.shell.uuid = child_uuid
        return retval.result

    def run_auto_updates(self, k):
        for cid in self.get_downstream(k):
            if self.auto_update_flags[cid]:
                upstreams = self.get_all_upstreams(cid)
                if all(not self.is_stale(upcid) or self.auto_update_flags[upcid]
                       for upcid in upstreams):
                    retval = self.execute_cell(cid)

    def __getitem__(self, k):
        res = self.get_item(k)
        if isinstance(res, LinkedResult):
            return res.__tuple__()
        return res


    def stale_check(self, k):
        class InvalidOutCell(KeyError):
            '''Called when an Invalid OutCell is called'''
        if k not in self.code_stale:
            raise InvalidOutCell("Out["+k + "] is an Invalid Out Cell Reference")

    def get_item(self, k):
        self.stale_check(k)
        self.update_dependencies(k, self.shell.uuid)
        # if k in self.value_cache:
        #     print(k, "in cache", self.value_cache[k])

        # force recompute
        if self.force_cached_flags[k]:
            if k not in self.value_cache:
                raise DataflowCacheException(k)
            # print("returning cache", k)
            return self.value_cache[k]

        # check if we need to recompute
        if not self.is_stale(k):
            # print("returning not stale cache", k)
            return self.value_cache[k]
        # print('executing cell', k)
        return self.execute_cell(k)

    def __setitem__(self, key, value):
        class InvalidCellModification(KeyError):
            '''This error results when another cell tries to modify an Out reference'''
        if key == self.shell.uuid:
            self.update_value(key, value)
        else:
            raise InvalidCellModification("Out[" + key + "] can only be modified by it's own cell")

    def get(self, k, default=None):
        try:
            return self.__getitem__(k)
        except KeyError:
            return default

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
        ovars = len(self.cell_ovars[uuid])
        if ovars > 1:
            res_cls = namedtuple('Result', self.cell_ovars[uuid])
            return res_cls(**res)
        elif ovars:
            return next(iter(res.values()))
        return retval

class CyclicalCallError(Exception):
    """This error results when the call being made is Cyclical"""
    def __init__(self, cell_id):
        super().__init__(self)
        self.cell_id = cell_id

    def __str__(self):
        return "Out[{}] results in a Cyclical call".format(self.cell_id)

class DuplicateNameError(Exception):
    def __init__(self, var_name, cell_id):
        super().__init__(self)
        self.var_name = var_name
        self.cell_id = cell_id

    def __str__(self):
        return "name '{}' has already been defined in Cell '{}'".format(self.var_name,self.cell_id)

class DataflowNamespace(dict):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.__links__ = {}
        self.__all_links__ = defaultdict(set)
        self.__rev_links__ = defaultdict(set)
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
        if k not in self.__do_not_link__ and k in self.__links__:
            # print("getting link", k)
            cell_id = self.get_parent(k)
            rev_links = self.__rev_links__[cell_id]
            # FIXME think about local variables...
            # FIXME do we need to compute difference first?
            self.__do_not_link__.update(rev_links)
            df_history = super().__getitem__('_oh')
            try:
                res = df_history.get_item(cell_id)
            except CyclicalCallError:
                raise
            self.__do_not_link__.difference_update(rev_links)
            return res[k]
        return super().__getitem__(k)



        # if k in self.links:
        #     # run the cell at self.links[k]
        #     pass
        # if k in self:
        #     return super().__getitem__(k)

    def get_parent(self,k):
        if k in self.__links__:
            return self.__links__[k]
        return None

    def complete(self, text, input_tags={}):
        results = []
        id_start = text
        cell_start = None
        if '$' in text:
            id_start, cell_start = text.split('$',maxsplit=1)
        import sys
        # print(f"COMPLETER INTERNAL: '{id_start}' '{cell_start}'", file=sys.__stdout__)
        for link, cell_ids in self.__all_links__.items():
            if link.startswith(id_start):
                if cell_start:
                    results.extend(link + '$' + input_tag
                                   for input_tag in input_tags
                                   if input_tag.startswith(cell_start))
                    results.extend(link + '$' + cell_id
                                   for cell_id in cell_ids
                                   if cell_id.startswith(cell_start))
                else:
                    if cell_start is None:
                        results.append(link)
                    results.extend(link + '$' + input_tag for input_tag in input_tags)
                    results.extend(link + '$' + cell_id for cell_id in cell_ids)
        return results

    def __setitem__(self, k, v):
        # FIXME question is whether to do this or allow local vars
        if k not in self.__do_not_link__ and k in self.__links__:
            raise DuplicateNameError(k, self.__links__[k])
        self.__local_vars__[self.__cur_uuid__][k] = v
        return super().__setitem__(k, v)

    def __contains__(self, k):
        return super().__contains__(k) or k in self.__links__

    def __delitem__(self, k):
        # FIXME check if k in self or self.__links__
        return super().__delitem__(k)

    def __iter__(self):
        return itertools.chain(super().__iter__(), iter(self.__links__))

    def __len__(self):
        return super().__len__() + len(self.__links__)

    def _add_links(self, tag_dict):
        """Used for adding links of pre-existing links currently only used for cold starts"""

        # FIXME really need to store this information in the notebook metadata
        # in order to keep track of this...
        new_tags = {}
        not_unique = set()
        for (cell_id, tag_list) in tag_dict.items():
            for tag in tag_list:
                self.__all_links__[tag].add(cell_id)
                if tag not in not_unique:
                    if tag in new_tags:
                        del new_tags[tag]
                        not_unique.add(tag)
                    else:
                        new_tags[tag] = cell_id
        for tag, cell_id in new_tags.items():
            # do not overwrite existing value
            if tag not in self.__links__:
                self._add_link(tag, cell_id)

    def _add_link(self, name, cell_id):
        # allow overwrite...
        # if name in self.__links__:
        #     if self.__links__[name] != cell_id:
        #         raise DuplicateNameError(name, self.__links__[name])
        # else:
        self.__all_links__[name].add(cell_id)
        self.__links__[name] = cell_id
        self.__rev_links__[cell_id].add(name)

    def _reset_cell(self, cell_id):
        for name in self.__rev_links__[cell_id]:
            if self.__links__[name] == cell_id:
                del self.__links__[name]
        del self.__rev_links__[cell_id]

    def _purge_local_vars(self):
        for k in list(self.__local_vars__[self.__cur_uuid__].keys()):
            del self.__local_vars__[self.__cur_uuid__][k]
            del self[k]

    def _stash_local_vars(self):
        # print("STASHING LOCAL VARS:", self.__cur_uuid__, self.__local_vars__[self.__cur_uuid__].keys())
        if self.__cur_uuid__ is not None:
            for key in self.__local_vars__[self.__cur_uuid__].keys():
                del self[key]

    def _unstash_local_vars(self):
        # print("UNSTASHING LOCAL VARS:", self.__cur_uuid__, self.__local_vars__[self.__cur_uuid__].keys())
        if self.__cur_uuid__ is not None:
            for key, val in self.__local_vars__[self.__cur_uuid__].items():
                # have to watch for variables that have been added by other cells
                if key not in self.__do_not_link__ and key in self.__links__:
                    raise DuplicateNameError(key, self.__links__[key])
                super().__setitem__(key, val)

    def _start_uuid(self, uuid):
        self._stash_local_vars()
        self.__cur_uuid__ = uuid

    def _revisit_uuid(self, old_uuid):
        self._purge_local_vars()
        self.__cur_uuid__ = old_uuid
        self._unstash_local_vars()

    def _is_external_link(self, k, uuid):
        return k in self.__links__ and self.__links__[k] != uuid

    # COPIED from collections.abc (MutableMapping cannot be assigned to __dict__)
    # FIXME: Changing get causes strange dependency issues
    #get = MutableMapping.get
    keys = MutableMapping.keys
    items = MutableMapping.items
    values = MutableMapping.values
    __eq__ = MutableMapping.__eq__
    pop = MutableMapping.pop
    popitem = MutableMapping.popitem
    clear = MutableMapping.clear
    update = MutableMapping.update
    setdefault = MutableMapping.setdefault
