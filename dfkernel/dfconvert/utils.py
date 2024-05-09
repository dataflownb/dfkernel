import ast
from io import StringIO
import tokenize
import json
from typing import Any
import itertools
import asttokens
import astor
import builtins
import re


DEFAULT_ID_LENGTH = 8

ref_uuids = set()

class DataflowRef:
    __slots__ = ['start_pos','end_pos','name','cell_id','cell_tag','ref_qualifier']

    def __init__(self, start_pos=None, end_pos=None, name=None, cell_id=None, cell_tag=None, ref_qualifier=None):
        self.start_pos = start_pos
        self.end_pos = end_pos
        self.name = name
        self.cell_id = cell_id
        self.cell_tag = cell_tag
        self.ref_qualifier = ref_qualifier

    @classmethod
    def fromstrstr(cls, s):
        return cls(**json.loads(json.loads(s)))

    def strstr(self):
        ref_uuids.add(self.cell_id)
        return json.dumps(json.dumps({
            'name': self.name,
            'cell_id': self.cell_id,
            'cell_tag': self.cell_tag,
            'ref_qualifier': self.ref_qualifier
        }))

    def __str__(self):
        qualifier = self.ref_qualifier if self.ref_qualifier is not None else ''
        if self.cell_tag:
            cell_tag = f'{self.cell_tag}:'
        else:
            cell_tag = ''
        return f'{self.name}_{qualifier}{cell_tag}{self.cell_id}'

    def __repr__(self):
        return f'DataflowRef({self.start_pos}, {self.end_pos}, {self.name}, {self.cell_id}, {self.cell_tag}, {self.ref_qualifier})'

class attrgetter:
    """
    Return a callable object that fetches the given attribute(s) from its operand.
    After f = attrgetter('name'), the call f(r) returns r.name.
    After g = attrgetter('name', 'date'), the call g(r) returns (r.name, r.date).
    After h = attrgetter('name.first', 'name.last'), the call h(r) returns
    (r.name.first, r.name.last).
    """
    __slots__ = ('_attrs', '_call')

    def __init__(self, attr, *attrs):
        if not attrs:
            if not isinstance(attr, str):
                raise TypeError('attribute name must be a string')
            self._attrs = (attr,)
            names = attr.split('.')
            def func(obj):
                for name in names:
                    obj = getattr(obj, name)
                return obj
            self._call = func
        else:
            self._attrs = (attr,) + attrs
            getters = tuple(map(attrgetter, self._attrs))
            def func(obj):
                return tuple(getter(obj) for getter in getters)
            self._call = func

    def __call__(self, obj):
        return self._call(obj)

    def __repr__(self):
        return '%s.%s(%s)' % (self.__class__.__module__,
                              self.__class__.__qualname__,
                              ', '.join(map(repr, self._attrs)))

    def __reduce__(self):
        return self.__class__, self._attrs

def identifier_replacer(ref):
    return f"__dfvar__[{ref.strstr()}]"

def ref_replacer(ref):
    # FIXME deal with tags and qualifiers
    return f"_oh['{ref.cell_id}']['{ref.name}']"

def dollar_replacer(ref):
    return str(ref)
    
def run_replacer(s, refs, replace_f):
    code_arr = s.splitlines()
    for ref in sorted(refs, key=attrgetter('end_pos'), reverse=True):
        # FIXME improve error handling
        assert ref.start_pos[0] == ref.end_pos[0]

        line = code_arr[ref.start_pos[0] - 1]
        code_arr[ref.start_pos[0] - 1] = \
            line[:ref.start_pos[1]] + replace_f(ref) + line[ref.end_pos[1]:]
    return '\n'.join(code_arr) 

def convert_dollar(s, replace_f=ref_replacer, input_tags={}):
    def positions_mesh(end, start):
        return end[0] == start[0] and end[1] == start[1]

    # res = defaultdict(list)
    updates = []
    s_stream = StringIO(s)

    dollar_pos = None
    var_name = None
    ref_qualifier = None
    cell_ref = ""
    last_token = None
    just_started = False

    """
    References can look like:
      * df or df$tag or df$f1f1f1 or df$tag:f1f1f1
      * df$^ or df$^f1f1f1 or df$^tag or df$^tag:f1f1f1
      * df$= or df$=f1f1f1 or df$=tag or df$=tag:f1f1f1
      * df$~tag or df$~tag:f1f1f1

    FIXME Do we need tilde?
    """
    for t in tokenize.generate_tokens(s_stream.readline):
        if t.string == '$':
            if last_token is not None and positions_mesh(last_token.end, t.start):
                dollar_pos = last_token.start, t.end
                var_name = last_token.string
                just_started = True
        elif dollar_pos is not None:
            if just_started and t.string in ['^','=','~'] and t.end[1] - t.start[1] == 1 and positions_mesh(dollar_pos[1], t.start):
                ref_qualifier = t.string
                dollar_pos = dollar_pos[0], t.end
                just_started = False
            elif t.string == ':' and t.end[1] - t.start[1] == 1 and positions_mesh(dollar_pos[1], t.start):
                cell_ref += ':'
                dollar_pos = dollar_pos[0], t.end
            elif t.type == 2 and positions_mesh(dollar_pos[1], t.start): # NUMBER
                t_string = t.string
                t_end = t.end
                while (
                    not re.match(r"[0-9a-f]+$", t_string)
                    and (t_end[0] > t.start[0] or t_end[1] > t.start[1])
                    and t_end[1] > 0
                ):
                    t_string = t_string[:-1]
                    t_end = (t_end[0], t_end[1] - 1)
                cell_ref += t_string
                dollar_pos = dollar_pos[0], t_end
                just_started = False
            elif t.type == 1 and positions_mesh(dollar_pos[1], t.start): # NAME
                cell_ref += t.string
                dollar_pos = dollar_pos[0], t.end                
                just_started = False
            else: # DONE
                if ':' in cell_ref:
                    cell_tag, cell_id = cell_ref.split(':')
                elif cell_ref in input_tags:
                    cell_tag = cell_ref
                    cell_id = input_tags[cell_ref]
                else:
                    cell_tag = None
                    cell_id = cell_ref
                updates.append(DataflowRef(
                    start_pos=dollar_pos[0],
                    end_pos=dollar_pos[1],
                    name=var_name,
                    cell_id=cell_id,
                    cell_tag=cell_tag,
                    ref_qualifier=ref_qualifier)
                )
                dollar_pos = None
                var_name = None
                ref_qualifier = None
                cell_ref = ""
                last_token = None
                just_started = False
                if t.type == 1: # NAME
                    last_token = t
        elif t.type == 1: # NAME
            last_token = t

    return run_replacer(s, updates, replace_f)

def convert_identifier(s, replace_f=ref_replacer):
    class DataflowReplacer(ast.NodeVisitor):
        def __init__(self):
            self.updates = []
            super().__init__()

        def visit_Subscript(self, node):
            if (isinstance(node.value, ast.Name)
                and node.value.id == '__dfvar__'):
                ref = DataflowRef(
                    start_pos=(node.lineno, node.col_offset),
                    end_pos=(node.end_lineno, node.end_col_offset),
                    **json.loads(node.slice.value)
                )
                self.updates.append(ref)
            self.generic_visit(node)

    tree = ast.parse(s)
    linker = DataflowReplacer()
    linker.visit(tree)
    return run_replacer(s, linker.updates, replace_f)

def convert_output_tags(code, output_tags, uuid, uuids_in_nb):
    def update_identifier(identifier, scope, imported_library = False):
        #case for imported library
        if imported_library:
            return identifier + f' as {identifier}_{uuid}'
        
        #check local scopes
        if len(scope) > 1:
            #checking local scopes
            for scope_vars in scope[:0:-1]:
                if identifier in scope_vars:
                    return identifier
                
        #check if identifier already converted      
        for id in uuids_in_nb:
            if id in identifier:
                return identifier
            
        #sepcial case: not available in 3.12.2 but available in 3.10 verifed in google colab
        if identifier == 'get_ipython':
            return identifier
        
        return identifier if identifier in dir(builtins) else f"{identifier}_{uuid}"
        
    class DataflowLinker(ast.NodeVisitor):
        def __init__(self):
            super().__init__()
            self.scope = [set()]
            self.updates = []

        def visit_Name(self, node):
            # FIXME what to do with del?
            if isinstance(node.ctx, ast.Store):
                self.scope[-1].add(node.id)
                node.id = update_identifier(node.id, self.scope)
            elif isinstance(node.ctx, ast.Del):
                self.scope[-1].discard(node.id)
            elif (isinstance(node.ctx, ast.Load)):
                node.id = update_identifier(node.id, self.scope)
            self.generic_visit(node)

        # need to make sure we visit right side before left!
        def visit_Assign(self, node):
            self.visit(node.value)
            for target in node.targets:
                self.visit(target)

        # FIXME we should rewrite augmented assignments to
        # deal with c += 12 where c is referencing another
        # cell's output
        def visit_AugAssign(self, node):
            self.visit(node.value)
            self.visit(node.target)

        def visit_AnnAssign(self, node):
            if node.value:
                self.visit(node.value)
            self.visit(node.annotation)
            self.visit(node.target)

        def process_function(self, node, add_name=True):
            if add_name:
                self.scope[-1].add(node.name)
                node.name = update_identifier(node.name, self.scope)
            func_args = set()
            for a in itertools.chain(node.args.args, node.args.posonlyargs, node.args.kwonlyargs):
                func_args.add(a.arg)
            self.scope.append(func_args)
            retval = self.generic_visit(node)
            self.scope.pop()
            return retval

        def visit_FunctionDef(self, node):
            return self.process_function(node)

        def visit_AsyncFunctionDef(self, node):
            return self.process_function(node)

        def visit_Lambda(self, node):
            return self.process_function(node, add_name=False)

        def visit_ClassDef(self, node):
            self.scope[-1].add(node.name)
            node.name = update_identifier(node.name, self.scope)
            self.scope.append(set())
            retval = self.generic_visit(node)
            self.scope.pop()
            return retval

        def process_import(self, node):
            # for alias in node.names:
            #     if alias.asname:
            #         self.scope[-1].add(alias.asname)
            #     else:
            #         self.scope[-1].add(alias.name)

            for index, alias in enumerate(node.names):
                if alias.asname:
                   self.scope[-1].add(alias.asname)
                   node.names[index].asname = update_identifier(alias.asname, self.scope)
                else:
                   self.scope[-1].add(alias.name)
                   node.names[index].name = update_identifier(alias.name, self.scope, True)
            self.generic_visit(node)

        def visit_Import(self, node):
            self.process_import(node)

        def visit_ImportFrom(self, node):
            self.process_import(node)

        def visit_ExceptHandler(self, node):
            self.scope.append(set())
            if node.name:
                self.scope[-1].add(node.name)
                node.name = update_identifier(node.name, self.scope)
            retval = self.generic_visit(node)
            self.scope.pop()
            return retval

        def process_elt_comp(self, node):
            self.scope.append(set())
            for generator in node.generators:
                self.visit(generator)
            self.visit(node.elt)
            self.scope.pop()

        def visit_ListComp(self, node):
            self.process_elt_comp(node)

        def visit_SetComp(self, node):
            self.process_elt_comp(node)

        def visit_GeneratorExp(self, node):
            self.process_elt_comp(node)

        def visit_DictComp(self, node):
            self.scope.append(set())
            for generator in node.generators:
                self.visit(generator)
            self.visit(node.key)
            self.visit(node.value)
            self.scope.pop()

        def visit_NamedExpr(self, node):
            self.visit(node.value)
            self.visit(node.target)

    tree = ast.parse(code)
    linker = DataflowLinker()
    linker.visit(tree)
    return ast.unparse(tree)

def transform_out_refs(csource,cast):
    offset = 0
    #Depth first traversal otherwise offset won't be accurate
    for node in asttokens.util.walk(cast.tree):
        if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Name) and node.value.id == 'Out':
            start, end = node.first_token.startpos + offset, node.last_token.endpos + offset
            #new_id = re.sub('Out\[[\"|\']?([0-9A-Fa-f]{' + str(DEFAULT_ID_LENGTH) + '})[\"|\']?\]', r'Out_\1', csource[start:end])
            #new_id = re.sub('Out\\[[\\"|\\']?([0-9A-Fa-f]{' + str(DEFAULT_ID_LENGTH) + '})[\\"|\\']?\\]', r'Out_\1', csource[start:end])
            new_id = re.sub(r'Out\[(?:["\']?)?([0-9A-Fa-f]{' + str(DEFAULT_ID_LENGTH) + r'})(?:["\']?)?\]', r'Out_\1', csource[start:end])
            csource = csource[:start] + new_id + csource[end:]
            ref_uuids.add(new_id[4:])
            offset = offset + (len(new_id) - (end - start))
    return csource

def transform_last_node(csource,cast,exec_count):
    if isinstance(exec_count,int):
        exec_count = ("{0:#0{1}x}".format(int(exec_count),8))[2:]
    if len(cast.tree.body) > 0 and isinstance(cast.tree.body[-1], ast.Expr):
        expr_val = cast.tree.body[-1].value
        if isinstance(expr_val, ast.Tuple):
            tuple_eles = []
            named_flag = False
            out_exists = False
            for idx, elt in enumerate(expr_val.elts):
                if isinstance(elt, ast.Name):
                    named_flag = True
                    tuple_eles.append(ast.Name(elt.id, ast.Store))
                else:
                    out_exists = True
                    tuple_eles.append(ast.Name('Out_' + str(exec_count) + '['+str(idx)+']', ast.Store))
            if (named_flag):
                nnode = ast.Assign([ast.Tuple(tuple_eles, ast.Store)], expr_val)
                out_assign = 'Out_'+str(exec_count)+' = []\n' if out_exists else ''
                ast.fix_missing_locations(nnode)
                start,end = cast.tree.body[-1].first_token.startpos, cast.tree.body[-1].last_token.endpos
                csource = csource[:start] + out_assign + astor.to_source(nnode) + csource[end:]
    return csource

def out_assign(csource,cast,exec_count,tags):
    #This is a special case where an a,3 type assignment happens
    tag_flag = bool([True if exec_count in (tag[:DEFAULT_ID_LENGTH] for tag in tags) else False].count(True))

    #no out assign if only print statement 
    # if(len(cast.tree.body) > 0 and  isinstance(cast.tree.body[-1].value, ast.Call) and isinstance(cast.tree.body[-1].value.func, ast.Name) and cast.tree.body[-1].value.func.id == 'print'):
    #     return csource, []
    if len(cast.tree.body) > 0 and isinstance(cast.tree.body[-1], ast.Expr) and isinstance(cast.tree.body[-1].value, ast.Call):
        return csource, []

    if tag_flag:
        if isinstance(cast.tree.body[-1], ast.Assign):
            new_node = ast.Name('Out_' + str(exec_count), ast.Store)
            nnode = cast.tree.body[-1]
            out_targets = nnode.targets.pop()
            nnode.targets.append(new_node)
            ast.fix_missing_locations(nnode)
            start, end = cast.tree.body[-1].first_token.startpos, cast.tree.body[-1].last_token.endpos
            csource = csource[:start] + astor.to_source(nnode) + csource[end:]
        return csource, out_targets
    if len(cast.tree.body) < 1:
        return csource, []
    if isinstance(cast.tree.body[-1],ast.Expr):
        expr_val = cast.tree.body[-1].value
        nnode = ast.Assign([ast.Name('Out_' + str(exec_count), ast.Store)], expr_val)
        ast.fix_missing_locations(nnode)
        start, end = cast.tree.body[-1].first_token.startpos, cast.tree.body[-1].last_token.endpos
        csource = csource[:start] + astor.to_source(nnode) + csource[end:]
    elif isinstance(cast.tree.body[-1],ast.Assign):
        new_node = ast.Name('Out_'+str(exec_count),ast.Store)
        nnode = cast.tree.body[-1]
        nnode.targets.append(new_node)
        ast.fix_missing_locations(nnode)
        start, end = cast.tree.body[-1].first_token.startpos, cast.tree.body[-1].last_token.endpos
        csource = csource[:start] + astor.to_source(nnode) + csource[end:]
    return csource, []