import { runCell } from '../src/cellexecutor';
import { type ICodeCellModel } from '@jupyterlab/cells';
import { SessionContext, ISessionContext } from '@jupyterlab/apputils';
import { DataflowCodeCell, getNotebookId, notebookCellMap } from '@dfnotebook/dfcells';
import { createSessionContext } from '@jupyterlab/apputils/lib/testutils';
import { JupyterServer } from '@jupyterlab/testing';
import { DataflowNotebookModel, DataflowNotebook as Notebook } from '../src';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import * as utils from './utils';
import { INotebookModel, NotebookPanel, StaticNotebook as StaticNotebookType } from '@jupyterlab/notebook';
import { NBTestUtils } from '@jupyterlab/notebook/lib/testutils';
import { Context } from '@jupyterlab/docregistry';
import { updateNotebookCellsWithTag }  from '../../dfnotebook-extension/src/index';

describe('Identifier reference update', () => {
  let sessionContext: ISessionContext;
  const server = new JupyterServer();
  let widget: Notebook;
  let rendermime: IRenderMimeRegistry;
  let notebook: INotebookModel;
  let context: Context<INotebookModel>;
  let panel: NotebookPanel;

  beforeAll(async () => {
    rendermime = utils.defaultRenderMime();
    await server.start({'additionalKernelSpecs':{'dfpython3':{'argv':['python','-m','dfkernel','-f','{connection_file}'],'display_name':'DFPython 3','language':'python'}}});
    sessionContext = await createSessionContext(
      {'kernelPreference':
      {'name':'dfpython3','autoStartDefault':true,'shouldStart':true}});
  
    await (sessionContext as SessionContext).initialize();
    await sessionContext.session?.kernel?.info;
    await sessionContext.session?.id;
    await sessionContext.startKernel();
  }, 30000);

  afterAll(async () => {
    await server.shutdown();
  });
  
  beforeEach(async () => {
    widget = new Notebook({
      rendermime,
      contentFactory: utils.createNotebookFactory(),
      mimeTypeService: utils.mimeTypeService,
      notebookConfig: {
        ...StaticNotebookType.defaultNotebookConfig,
        windowingMode: 'none'
      }
    });
    context = await utils.createMockContext();
    panel = utils.createNotebookPanel(context);
    panel.id = 'mock-notebook-panel';
    
    const model = new DataflowNotebookModel();
    widget.model = model;
    model.sharedModel.clearUndoHistory();
    widget.activeCellIndex = 0;

    notebook = widget.model;
    if (!notebook) {
      throw new Error('Notebook model is null');
    }
  });
    
  afterEach(() => {
    return sessionContext.shutdown();
  });

  async function runNotebookCell(notebook: INotebookModel, cellModel: ICodeCellModel) {
    const cell = new DataflowCodeCell({
      model: cellModel,
      rendermime: rendermime,
      contentFactory: NBTestUtils.createBaseCellFactory()
    });

    cell.parent = panel;
    let notebookId = getNotebookId(cell as DataflowCodeCell);
    if(notebookId){
      notebookCellMap.set(notebookId, new Map<string, string>());
    }

    const result = await runCell({
      cell,
      notebook,
      sessionContext,
      notebookConfig: {
        defaultCell: 'code',
        disableDocumentWideUndoRedo: false,
        enableKernelInitNotification: true,
        maxNumberOutputs: 50,
        windowingMode: 'none',
        scrollPastEnd: true,
        showHiddenCellsButton: false,
        recordTiming: false,
        overscanCount: 1,
        renderingLayout: 'default',
        inputHistoryScope: 'session',
        sideBySideLeftMarginOverride: 'none',
        sideBySideRightMarginOverride: 'none',
        sideBySideOutputRatio: 0
      },
      onCellExecuted: ({ cell, success, error }) => {
        console.log(`Cell executed: ${success}`);
        if (error) {
          console.error(error);
        }
      },
      onCellExecutionScheduled: ({ cell }) => {
        console.log('Cell execution scheduled');
      }
    });

    return result;
  }

  describe('Update references with UUID', () => {
    it('Reference UUID is not added when identifier is exported only once', async () => {
      // Code cell 1
      notebook.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });

      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      
      // verifies code cell execution
      let cAny = notebook?.cells.get(0) as ICodeCellModel;
      expect(result).toBe(true);
      expect(cAny.outputs.length).toBe(1);
      expect(cAny.outputs.get(0).data['text/plain']).toBe('9');
  
      //Code cell 2
      notebook.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'b=a+9',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
  
      // verifies no ref UUID is added for identifier 'a' since it is exported only once
      cAny = notebook?.cells.get(1) as ICodeCellModel;
      expect(result).toBe(true);
      expect(cAny.outputs.length).toBe(1);
      expect(cAny.outputs.get(0).data['text/plain']).toBe('18');
      expect(cAny.sharedModel.source).toBe('b=a+9');
    });
  
    it('Reference UUID is not removed when ambiguity exist', async () => {
      // Code cell 1
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });
  
      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      const refId = (notebook?.cells.get(0) as ICodeCellModel).id.replace(/-/g, '').substring(0, 8);
      //Code cell 2
      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'a=5\ntest=a+99\nb=a$'+refId+'+99',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      
      let cAny = notebook?.cells.get(1) as ICodeCellModel;
      expect(result).toBe(true);
      expect(cAny.outputs.length).toBe(1);
      expect(cAny.outputs.get(0).data['text/plain']).toBe('108');
      expect(cAny.sharedModel.source).toBe('a=5\ntest=a+99\nb=a$'+refId+'+99');
    });
  
    it('Dfmetadata should be updated with references', async () => {
      // Code cell 1
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });
  
      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
  
      //Code cell 2
      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'b=a+9',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
  
      let cAny = notebook?.cells.get(1) as ICodeCellModel;
      const refId = (notebook?.cells.get(0) as ICodeCellModel).id.replace(/-/g, '').substring(0, 8);
      let dfmetadata = cAny.getMetadata("dfmetadata")
      expect(result).toBe(true);    
      expect(dfmetadata).toBeDefined();
      expect(dfmetadata.inputVars).toEqual({
        "ref": {
          [refId]: ["a"]
        },
        "tag_refs": {}
      });
      expect(dfmetadata.outputVars).toEqual(['b'])
    });
  
    it('Reference UUID is added when same identifier exported more than once', async () => {
      // Code cell 1
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });

      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
  
      //Code cell 2
      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'b=a+9',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
      
      //Code cell 3
      notebook?.sharedModel.insertCell(2, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(2) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
      
      let cAny = notebook?.cells.get(1) as ICodeCellModel;
      const refId = (notebook?.cells.get(0) as ICodeCellModel).id.replace(/-/g, '').substring(0, 8);
      expect(result).toBe(true);
      expect(cAny.sharedModel.source).toBe('b=a$'+refId+'+9');
    });

    it('When an identifier is exported multiple times and later reduced to one, the UUID is removed', async () => {
      // Code cell 1
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });
  
      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
  
      //Code cell 2
      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'b=a+9',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
      
      //Code cell 3
      notebook?.sharedModel.insertCell(2, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(2) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      
      let cAny = notebook?.cells.get(1) as ICodeCellModel;
      const refId = (notebook?.cells.get(0) as ICodeCellModel).id.replace(/-/g, '').substring(0, 8);
      expect(result).toBe(true);
      expect(cAny.sharedModel.source).toBe('b=a$'+refId+'+9');

      //deleting code cell 2
      notebook.sharedModel.deleteCell(2)

      cellModel = notebook?.cells.get(0) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
      expect(cAny.sharedModel.source).toBe('b=a+9');
    });
  
    it('Reference UUID is added to identifier when its reference cell is deleted', async () => {
      // Code cell 1
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });
  
      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      const refId = (notebook?.cells.get(0) as ICodeCellModel).id.replace(/-/g, '').substring(0, 8);
      expect(result).toBe(true);
  
      //Code cell 2
      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'b=a+9',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
  
      notebook.sharedModel.deleteCellRange(0,1);
      
      //Code cell 3
      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'h=9',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
  
      let cAny = notebook?.cells.get(0) as ICodeCellModel;
      expect(result).toBe(true);
      expect(cAny.sharedModel.source).toBe('b=a$'+refId+'+9');
    })
  
    it('Reference UUID is added to identifier when its ref is removed by updating cell', async () => {
      // Code cell 1
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });
  
      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
  
      //Code cell 2
      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'b=a+9',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
      
      //Running cell 1
      cellModel = notebook?.cells.get(0) as ICodeCellModel;
      cellModel.sharedModel.setSource('k=0');
      result = await runNotebookCell(notebook, cellModel);
  
      let cAny = notebook?.cells.get(1) as ICodeCellModel;
      const refId = (notebook?.cells.get(0) as ICodeCellModel).id.replace(/-/g, '').substring(0, 8);
      expect(result).toBe(true);
      expect(cAny.sharedModel.source).toBe('b=a$'+refId+'+9');
    })
  });

  describe('Update references with Tags', () => {
    it('Should able to use tag as identifier ref', async () => {
      // Code cell 1
      notebook.setMetadata("enable_tags", true);
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });

      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);

      let dfmetadata = (notebook?.cells.get(0) as ICodeCellModel).getMetadata('dfmetadata');
      dfmetadata.tag = "Tag1";
      notebook.cells.get(0).setMetadata('dfmetadata', dfmetadata);

      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'a=5\ntest=a+99\nb=a$Tag1+99',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      
      let cAny = notebook?.cells.get(1) as ICodeCellModel;
      expect(result).toBe(true);
      expect(cAny.outputs.length).toBe(1);
      expect(cAny.outputs.get(0).data['text/plain']).toBe('108');
      expect(cAny.sharedModel.source).toBe('a=5\ntest=a+99\nb=a$Tag1+99');
    });
  
    it('CellId should be replaced with tag in codecells when tag is added', async () => {
      // Code cell 1
      notebook.setMetadata("enable_tags", true);
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });

      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      const refId = (notebook?.cells.get(0) as ICodeCellModel).id.replace(/-/g, '').substring(0, 8);
      let result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);

      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'a=5\ntest=a+99\nb=a$'+refId+'+99',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);

      let dfmetadata = (notebook?.cells.get(0) as ICodeCellModel).getMetadata('dfmetadata');
      dfmetadata.tag = "Tag1";
      notebook.cells.get(0).setMetadata('dfmetadata', dfmetadata);

      await updateNotebookCellsWithTag("", notebook as DataflowNotebookModel, '', sessionContext)
      
      let cAny = notebook?.cells.get(1) as ICodeCellModel;
      expect(cAny.sharedModel.source).toBe('a=5\ntest=a+99\nb=a$Tag1+99');
    });

    it('Dfmetadata should be updated with tag references', async () => {
      // Code cell 1
      notebook.setMetadata("enable_tags", true);
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });

      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);

      let dfmetadata = (notebook?.cells.get(0) as ICodeCellModel).getMetadata('dfmetadata');
      dfmetadata.tag = "Tag1";
      notebook.cells.get(0).setMetadata('dfmetadata', dfmetadata);

      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'a=5\ntest=a+99\nb=a$Tag1+99',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      
      let cAny = notebook?.cells.get(1) as ICodeCellModel;
      const refId = (notebook?.cells.get(0) as ICodeCellModel).id.replace(/-/g, '').substring(0, 8);
      dfmetadata = cAny.sharedModel.getMetadata('dfmetadata')
      
      expect(result).toBe(true);
      expect(cAny.outputs.length).toBe(1);
      expect(cAny.outputs.get(0).data['text/plain']).toBe('108');
      expect(cAny.sharedModel.source).toBe('a=5\ntest=a+99\nb=a$Tag1+99');
      expect(dfmetadata).toBeDefined();
      expect(dfmetadata.inputVars).toEqual({
        "ref": {
          [refId]: ["a"]
        },
        "tag_refs": {
          [refId]: "Tag1"
        }
      });
    });
  
    it('Tag should be replaced with UUID when tag is removed', async () => {
      // Code cell 1
      notebook.setMetadata("enable_tags", true);
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });

      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);

      const refId = (notebook?.cells.get(0) as ICodeCellModel).id.replace(/-/g, '').substring(0, 8);
      let dfmetadata = (notebook?.cells.get(0) as ICodeCellModel).getMetadata('dfmetadata');
      dfmetadata.tag = "Tag1";
      notebook.cells.get(0).setMetadata('dfmetadata', dfmetadata);

      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'a=5\ntest=a+99\nb=a$Tag1+99',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);

      //deleting tag
      dfmetadata = (notebook?.cells.get(0) as ICodeCellModel).getMetadata('dfmetadata');
      dfmetadata.tag = "";
      notebook.cells.get(0).setMetadata('dfmetadata', dfmetadata);

      await updateNotebookCellsWithTag("", notebook as DataflowNotebookModel, refId, sessionContext)

      let cAny = notebook?.cells.get(1) as ICodeCellModel;
      expect(cAny.outputs.length).toBe(1);
      expect(cAny.outputs.get(0).data['text/plain']).toBe('108');
      expect(cAny.sharedModel.source).toBe('a=5\ntest=a+99\nb=a$'+refId+'+99');
    })

    it('Tag should be replaced with UUID when tagged cell is deleted', async () => {
      // Code cell 1
      notebook.setMetadata("enable_tags", true);
      notebook?.sharedModel.insertCell(0, {
        cell_type: 'code',
        source: 'a=9',
        metadata: {
          trusted: false
        }
      });

      let cellModel = notebook?.cells.get(0) as ICodeCellModel;
      let result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);

      const refId = (notebook?.cells.get(0) as ICodeCellModel).id.replace(/-/g, '').substring(0, 8);
      let dfmetadata = (notebook?.cells.get(0) as ICodeCellModel).getMetadata('dfmetadata');
      dfmetadata.tag = "Tag1";
      notebook.cells.get(0).setMetadata('dfmetadata', dfmetadata);

      // Code cell 2
      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 'a=5\ntest=a+99\nb=a$Tag1+99',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);

      //deleting code cell 1
      notebook.sharedModel.deleteCellRange(0,1)

      // Code cell 3
      notebook?.sharedModel.insertCell(1, {
        cell_type: 'code',
        source: 's = "test"',
        metadata: {
          trusted: false
        }
      });
  
      cellModel = notebook?.cells.get(1) as ICodeCellModel;
      result = await runNotebookCell(notebook, cellModel);
      expect(result).toBe(true);
      
      let cAny = notebook?.cells.get(0) as ICodeCellModel;
      expect(cAny.sharedModel.source).toBe('a=5\ntest=a+99\nb=a$'+refId+'+99');
    })

  });

});