import asttokens
from . import utils
from .topological import topological
from IPython.core.inputtransformer2 import TransformerManager
from .display_cell import display_variable_cell 

def convert_notebook(notebook):
    code_cells_ref = dict()
    non_code_cells_ref = dict()
    uuids_downlinks = dict()
    uuids_output_tags = dict()
    non_code_cells = list()
    transformer_manager = TransformerManager()
    valid_output_tags = dict()
    for cell in notebook['cells']:
        output_tags = list()
        id = cell['id'].split('-')[0]
        if cell['cell_type'] != "code":
            non_code_cells.append(id)
        else:
            if len(non_code_cells) > 0:
                non_code_cells_ref[id] = non_code_cells[:]
                non_code_cells.clear()

            valid_output_tags[id] = []
            for output in cell['outputs']:
                if output.get('metadata') and output['metadata'].get('output_tag'):
                    output_tags.append(output['metadata']['output_tag'])
                    output['execution_count'] = None
                    valid_output_tags[id].append(output['metadata']['output_tag'])
                elif output.get('data') and output['data'].get('text/plain'):
                    output['execution_count'] = None

            if len(cell['outputs']) > 0:
                cell['outputs'][0]['execution_count'] = None
            cell['execution_count'] = None
            uuids_output_tags[id] = output_tags
        code_cells_ref[id] = cell
    
    for uuid, cell in code_cells_ref.items():
        utils.ref_uuids = set()
        code= transformer_manager.transform_cell(cell['source'])
        code = utils.convert_dollar(code, utils.identifier_replacer, {})
        code = utils.convert_identifier(code, utils.dollar_replacer)
        code = utils.convert_output_tags(code, uuids_output_tags[uuid], uuid, code_cells_ref.keys())

        cast = asttokens.ASTTokens(code, parse=True)
        code = utils.transform_out_refs(code, cast)
        cast = asttokens.ASTTokens(code, parse=True)
        code = utils.transform_last_node(code, cast, uuid)

        cast = asttokens.ASTTokens(code, parse=True)
        code, out_targets = utils.out_assign(code, cast, uuid, valid_output_tags[uuid])
        
        code_cells_ref[uuid]['source'] = code.strip()
        
        #add print statement end of each code
        if uuids_output_tags.get(uuid):
            exported_variables = '{ '
            for value in uuids_output_tags[uuid]:
                if len(value) >= 8 and (value[:8] in code_cells_ref.keys() or uuid == value[:8]):
                    continue
                exported_variables += f'"{value}_{uuid}": {value}_{uuid},'
            exported_variables += '}'
            
            if len(exported_variables) > 3:
                code += '\ndisplay_variables(' + exported_variables + ')'
            else:
                if ('Out_'+uuid) in code:
                    exported_variables = f'"Out_{uuid}": Out_{uuid},'
                    code += '\ndisplay_variables( { ' + exported_variables + ' })'
        else:
                if ('Out_'+uuid) in code:
                    exported_variables = f'"Out_{uuid}": Out_{uuid},'
                    code += '\ndisplay_variables({ ' + exported_variables + ' })'

        code_cells_ref[uuid]['source'] = code

        uuids_downlinks[uuid] = [id for id in utils.ref_uuids]
    
    sorted_order = list(topological(uuids_downlinks))
    notebook['cells'] = display_variable_cell + [code_cells_ref[cell_id] for cell_id in sorted_order[::-1]]

    return notebook
