import ast
import re

import tokenize
from io import StringIO
from collections import defaultdict
from operator import attrgetter

def default_replacer(cell_id, var):
    return f"_oh['{cell_id}']['{var}']"

def identifier_replacer(cell_id, var):
    return f"__dfvar_{cell_id}_{var}__"

def dollar_replacer(cell_id, var):
    return f"{var}${cell_id}"

def convert_dollar(s, replace_f=default_replacer, input_tags={}):
    while True:
        try:
            nodes = ast.parse(s)
            break
        except SyntaxError as e:
            new_s = ""
            for i, line in enumerate(s.splitlines(True)):
                if e.lineno == i+1:
                    if line[e.offset-1] == '$':
                        # have dollar sign issue
                        before = line[e.offset-2::-1]
                        after = line[e.offset:]
                        m1 = re.match(r'\w*[^\d\W]', before)
                        # FIXME just allow digits, letters, and _ for now
                        m2 = re.match(r'[0-9a-zA-Z]+', after)
                        if m1 and m2:
                            before_g = m1.group(0)
                            after_g = m2.group(0)
                            before_len = len(before_g)
                            after_len = len(after_g)
                            new_s += line[:e.offset-1-before_len]
                            cell_id = after_g
                            var = before_g[::-1]
                            # convert input_tags to cell_ids
                            if cell_id in input_tags:
                                cell_id = input_tags[cell_id]
                            new_s += replace_f(cell_id, var)
                            new_s += line[e.offset+after_len:]
                        else:
                            raise e
                    else:
                        raise e
                else:
                    new_s += line
            s = new_s
    return s

def convert_dfvar(s, replacer_f=default_replacer):
    dfvar_re = re.compile(r'__dfvar_([0-9a-f]+)_([^\d\W]\w*)__\Z')

    updates = []

    class DataflowReplacer(ast.NodeVisitor):
        def visit_Name(self, name):
            m = dfvar_re.match(name.id)
            if m:
                cell_id = m.group(1)
                var_name = m.group(2)
                updates.append((name.end_lineno, name.end_col_offset,
                                name.lineno, name.col_offset, cell_id, var_name))
            self.generic_visit(name)

    tree = ast.parse(s)
    linker = DataflowReplacer()
    linker.visit(tree)
    code_arr = s.splitlines()
    for end_lineno, end_col_offset, lineno, col_offset, cell_id, var_name in sorted(
            updates, reverse=True):
        if lineno != end_lineno:
            raise Exception("Names cannot be split over multiple lines")
        s = code_arr[lineno - 1]
        code_arr[lineno - 1] = ''.join(
            [s[:col_offset], replacer_f(cell_id, var_name), s[end_col_offset:]])
    return '\n'.join(code_arr)

class DataflowRef:
    __slots__ = ['start_pos','end_pos','name','cell_id','cell_tag','ref_qualifier']

    def __init__(self, start_pos, end_pos, name, cell_id, cell_tag=None, ref_qualifier=None):
        self.start_pos = start_pos
        self.end_pos = end_pos
        self.name = name
        self.cell_id = cell_id
        self.cell_tag = cell_tag
        self.ref_qualifier = ref_qualifier

    def __repr__(self):
        return f'DataflowRef({self.start_pos}, {self.end_pos}, {self.name}, {self.cell_id}, {self.cell_tag}, {self.ref_qualifier})'

def identifier_replacer(ref):
    # FIXME deal with tags and qualifiers
    return f"__dfvar_{ref.cell_id}_{ref.name}__"

def ref_replacer(ref):
    # FIXME deal with tags and qualifiers
    return f"_oh['{ref.cell_id}']['{ref.name}']"

def convert_dollar(s, replace_f=ref_replacer, input_tags={}):
    def positions_mesh(end, start):
        return end[0] == start[0] and end[1] == start[1]

    res = defaultdict(list)
    s_stream = StringIO(s)

    dollar_pos = None
    var_name = None
    ref_qualifier = None
    cell_ref = ""
    last_token = None

    for t in tokenize.generate_tokens(s_stream.readline):
        if t.string == '$':
            if last_token is not None and positions_mesh(last_token.end, t.start):
                dollar_pos = last_token.start, t.end
                var_name = last_token.string
        elif dollar_pos is not None:
            if t.string in ['-','+'] and t.end[1] - t.start[1] == 1 and positions_mesh(dollar_pos[1], t.start):
                ref_qualifier = t.string
                dollar_pos = dollar_pos[0], t.end
            elif t.type == 2 and positions_mesh(dollar_pos[1], t.start): # NUMBER
                cell_ref += t.string
                dollar_pos = dollar_pos[0], t.end
            elif t.type == 1 and positions_mesh(dollar_pos[1], t.start): # NAME
                cell_ref += t.string
                dollar_pos = dollar_pos[0], t.end                
            else: # DONE
                if cell_ref in input_tags:
                    cell_tag = cell_ref
                    cell_id = input_tags[cell_ref]
                else:
                    cell_id = cell_ref
                    cell_tag = None
                res[dollar_pos[0][0]].append(DataflowRef(
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
                if t.type == 1: # NAME
                    last_token = t
        elif t.type == 1: # NAME
            last_token = t

    s_stream.seek(0)
    out_s = ""
    res = dict(res)
    # print("RES:", res)
    for i, line in enumerate(s_stream.readlines()):
        for ref in sorted(res.get(i+1,[]), key=attrgetter('end_pos'), reverse=True):
            # FIXME improve error handling
            assert ref.start_pos[0] == ref.end_pos[0]
            line = line[:ref.start_pos[1]] + replace_f(ref) + line[ref.end_pos[1]:]
        out_s += line
    # print("OUT S:", out_s)
    return out_s


# find positions and then replace them later?



