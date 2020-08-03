import ast
import re

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
