from _ast import Subscript
import ast
import re

import tokenize
from io import StringIO
from collections import defaultdict
from operator import attrgetter
import json
from typing import Any

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
        return f'{self.name}${qualifier}{cell_tag}{self.cell_id}'

    def __repr__(self):
        return f'DataflowRef({self.start_pos}, {self.end_pos}, {self.name}, {self.cell_id}, {self.cell_tag}, {self.ref_qualifier})'

def identifier_replacer(ref):
    return f"__dfvar__[{ref.strstr()}]"

def ref_replacer(ref):
    # FIXME deal with tags and qualifiers
    return f"_oh['{ref.cell_id}']['{ref.name}']"

def dollar_replacer(ref):
    return str(ref)

def update_refs(refs, dataflow_state, execution_count, input_tags):
    for ref in refs:
        if ref.ref_qualifier == '^' or (not ref.cell_tag and not ref.cell_id):
            # get latest cell_id
            # FIXME is_external_link needs to be updated to find
            # the external link that is not the current uuid...
            if dataflow_state.has_external_link(ref.name, execution_count):
                ref.cell_id = dataflow_state.get_external_link(ref.name, execution_count)
            # print("ASSIGNING CELL_ID:", ref.cell_id)

        if ref.cell_tag is not None:
            if ref.cell_tag not in input_tags:
                if ref.ref_qualifier == '^':
                    ref.cell_tag = None
                else:
                    raise ValueError(f"Cell with tag '{ref.cell_tag}' does not exist")
            else:
                if ref.ref_qualifier == '=' and ref.cell_id and ref.cell_id != input_tags[ref.cell_tag]:
                    raise ValueError(f"Tag '{ref.cell_tag}' no longer references cell '{ref.cell_id}'. Consider removing the = qualifier.")
                else:
                    if ref.cell_id and ref.cell_id != input_tags[ref.cell_tag]:
                        if ref.ref_qualifier == '^':
                            ref.cell_tag = None
                        else:
                            ref.cell_id = input_tags[ref.cell_tag]
        # print("REF OUT:", ref)

def run_replacer(s, refs, replace_f):
    code_arr = s.splitlines()
    for ref in sorted(refs, key=attrgetter('end_pos'), reverse=True):
        # FIXME improve error handling
        assert ref.start_pos[0] == ref.end_pos[0]

        line = code_arr[ref.start_pos[0] - 1]
        code_arr[ref.start_pos[0] - 1] = \
            line[:ref.start_pos[1]] + replace_f(ref) + line[ref.end_pos[1]:]
    return '\n'.join(code_arr)    

def ground_refs(s, dataflow_state, execution_count, replace_f=ref_replacer, input_tags={}):
    updates = []

    class DataflowLinker(ast.NodeVisitor):
        def __init__(self):
            self.stored = set()
            self.updates = []
            super().__init__()

        # need to make sure we visit right side before left!
        # seems to happen by default?
        def visit_Assign(self, node):
            self.visit(node.value)
            for target in node.targets:
                self.visit(target)

        def visit_Name(self, node):
            # FIXME what to do with del?
            if isinstance(node.ctx, ast.Store):
                # print("STORE", name.id, file=sys.__stdout__)
                self.stored.add(node.id)
            elif (isinstance(node.ctx, ast.Load) and
                    node.id not in self.stored and
                    dataflow_state.has_external_link(node.id, execution_count)):
                # figure out where we are and keep track of change
                # FIXME get_parent needs to get most recently used verison of id
                cell_id = dataflow_state.get_external_link(node.id, execution_count)
                ref = DataflowRef(
                    start_pos=(node.lineno, node.col_offset),
                    end_pos=(node.end_lineno, node.end_col_offset),
                    name=node.id,
                    cell_id=cell_id
                )
                self.updates.append(ref)
                # print("LOAD", name.id, cell_id, file=sys.__stdout__)
            self.generic_visit(node)

    tree = ast.parse(s)
    linker = DataflowLinker()
    linker.visit(tree)

    update_refs(linker.updates, dataflow_state, execution_count, input_tags)

    return run_replacer(s, linker.updates, replace_f)

def convert_dollar(s, dataflow_state, execution_count, replace_f=ref_replacer, input_tags={}):
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
                cell_ref += t.string
                dollar_pos = dollar_pos[0], t.end
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

    # print("UPDATES:", updates)
    update_refs(updates, dataflow_state, execution_count, input_tags)

    return run_replacer(s, updates, replace_f)

def convert_identifier(s, replace_f=ref_replacer):
    class DataflowReplacer(ast.NodeVisitor):
        def __init__(self):
            self.updates = []
            super().__init__()

        def visit_Subscript(self, node):
            if (isinstance(node.value, ast.Name)
                and node.value.id == '__dfvar__'):
                # print("NODE SLICE VALUE:", node.slice.value)
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