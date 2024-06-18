import { Dialog, showDialog } from '@jupyterlab/apputils';
import {
    CodeCell,
  type Cell,
  type ICodeCellModel,
  type MarkdownCell
} from '@jupyterlab/cells';
import type { KernelMessage } from '@jupyterlab/services';
import { nullTranslator } from '@jupyterlab/translation';
import { findIndex } from '@lumino/algorithm';
import { KernelError, INotebookModel, INotebookCellExecutor } from '@jupyterlab/notebook';
import { DataflowCodeCell } from '@dfnotebook/dfcells';
import { DataflowNotebookModel } from './model';
import { truncateCellId } from '@dfnotebook/dfutils';

/**
 * Run a single notebook cell.
 *
 * @param options Cell execution options
 * @returns Execution status
 */
export async function runCell({
    cell,
    notebook,
    notebookConfig,
    onCellExecuted,
    onCellExecutionScheduled,
    sessionContext,
    sessionDialogs,
    translator
  }: INotebookCellExecutor.IRunCellOptions): Promise<boolean> {
    translator = translator ?? nullTranslator;
    const trans = translator.load('jupyterlab');
    switch (cell.model.type) {
      case 'markdown':
        (cell as MarkdownCell).rendered = true;
        cell.inputHidden = false;
        onCellExecuted({ cell, success: true });
        break;
      case 'code':
        if (sessionContext) {
          if (sessionContext.isTerminating) {
            await showDialog({
              title: trans.__('Kernel Terminating'),
              body: trans.__(
                'The kernel for %1 appears to be terminating. You can not run any cell for now.',
                sessionContext.session?.path
              ),
              buttons: [Dialog.okButton()]
            });
            break;
          }
          if (sessionContext.pendingInput) {
            await showDialog({
              title: trans.__('Cell not executed due to pending input'),
              body: trans.__(
                'The cell has not been executed to avoid kernel deadlock as there is another pending input! Submit your pending input and try again.'
              ),
              buttons: [Dialog.okButton()]
            });
            return false;
          }
          if (sessionContext.hasNoKernel) {
            const shouldSelect = await sessionContext.startKernel();
            if (shouldSelect && sessionDialogs) {
              await sessionDialogs.selectKernel(sessionContext);
            }
          }
  
          if (sessionContext.hasNoKernel) {
            cell.model.sharedModel.transact(() => {
              (cell.model as ICodeCellModel).clearExecution();
            });
            return true;
          }
  
          const deletedCells = notebook.deletedCells;

          onCellExecutionScheduled({ cell });
  
          let ran = false;
          try {
            let reply: KernelMessage.IExecuteReplyMsg | void;
            // !!! DATAFLOW NOTEBOOK CODE !!!
            if (notebook instanceof DataflowNotebookModel) {
                const codeDict: { [key: string]: string } = {};
                const cellIdModelMap: { [key: string]: any } = {};
                const outputTags: { [key: string]: string[] } = {};
                const inputTags: { [key: string]: string } = {};
                    if (notebook) {
                    for (let index = 0; index < notebook.cells.length; index++) {
                    const cAny = notebook.cells.get(index);
                    if (cAny.type === 'code') {
                        const c = cAny as ICodeCellModel;
                        const cId = truncateCellId(c.id)
                        const inputTag = c.getMetadata('tag');
                        if (inputTag) {
                        // FIXME need to check for duplicates!
                        inputTags[inputTag as string] = cId;
                        }
                        codeDict[cId] = c.sharedModel.getSource();
                        cellIdModelMap[cId] = c;
                        let cellOutputTags: string[] = [];
                        for (let i = 0; i < c.outputs.length; ++i) {
                        const out = c.outputs.get(i);
                        if (out.metadata['output_tag']) {
                            cellOutputTags.push(out.metadata['output_tag'] as string);
                        }
                        }
                        outputTags[cId] = cellOutputTags;
                    }
                    };
                }
                // console.log('codeDict:', codeDict);
                // console.log('cellIdWidgetMap:', cellIdWidgetMap);
                // console.log('outputTags:', outputTags);
                // console.log('inputTags:', inputTags);
    
                const dfData = {
                    // FIXME replace with utility function (see dfcells/widget)
                    uuid: truncateCellId(cell.model.id) || '',
                    code_dict: codeDict,
                    output_tags: outputTags, // this.notebook.get_output_tags(Object.keys(code_dict)),
                    input_tags: inputTags,
                    auto_update_flags: {}, // this.notebook.get_auto_update_flags(),
                    force_cached_flags: {} // this.notebook.get_force_cached_flags()})
                };
    
                reply = await DataflowCodeCell.execute(
                    cell as DataflowCodeCell,
                    sessionContext,
                    {
                    deletedCells,
                    recordTiming: notebookConfig.recordTiming
                    },
                    dfData,
                    cellIdModelMap
                );
            } else {
                reply = await CodeCell.execute(
                cell as CodeCell,
                sessionContext,
                {
                    deletedCells,
                    recordTiming: notebookConfig.recordTiming
                }
                );
            }
            // !!! END DATAFLOW NOTEBOOK CODE !!!
              
            deletedCells.splice(0, deletedCells.length);
  
            ran = (() => {
              if (cell.isDisposed) {
                return false;
              }
  
              if (!reply) {
                return true;
              }
              if (reply.content.status === 'ok') {
                const content = reply.content;
  
                if (content.payload && content.payload.length) {
                  handlePayload(content, notebook, cell);
                }
  
                return true;
              } else {
                throw new KernelError(reply.content);
              }
            })();
          } catch (reason) {
            if (cell.isDisposed || reason.message.startsWith('Canceled')) {
              ran = false;
            } else {
              onCellExecuted({
                cell,
                success: false,
                error: reason
              });
              throw reason;
            }
          }
  
          if (ran) {
            onCellExecuted({ cell, success: true });
          }
  
          return ran;
        }
        cell.model.sharedModel.transact(() => {
          (cell.model as ICodeCellModel).clearExecution();
        }, false);
        break;
      default:
        break;
    }
  
    return Promise.resolve(true);
  }
  
  /**
   * Handle payloads from an execute reply.
   *
   * #### Notes
   * Payloads are deprecated and there are no official interfaces for them in
   * the kernel type definitions.
   * See [Payloads (DEPRECATED)](https://jupyter-client.readthedocs.io/en/latest/messaging.html#payloads-deprecated).
   */
  function handlePayload(
    content: KernelMessage.IExecuteReply,
    notebook: INotebookModel,
    cell: Cell
  ) {
    const setNextInput = content.payload?.filter(i => {
      return (i as any).source === 'set_next_input';
    })[0];
  
    if (!setNextInput) {
      return;
    }
  
    const text = setNextInput.text as string;
    const replace = setNextInput.replace;
  
    if (replace) {
      cell.model.sharedModel.setSource(text);
      return;
    }
  
    // Create a new code cell and add as the next cell.
    const notebookModel = notebook.sharedModel;
    const cells = notebook.cells;
    const index = findIndex(cells, model => model === cell.model);
  
    // While this cell has no outputs and could be trusted following the letter
    // of Jupyter trust model, its content comes from kernel and hence is not
    // necessarily controlled by the user; if we set it as trusted, a user
    // executing cells in succession could end up with unwanted trusted output.
    if (index === -1) {
      notebookModel.insertCell(notebookModel.cells.length, {
        cell_type: 'code',
        source: text,
        metadata: {
          trusted: false
        }
      });
    } else {
      notebookModel.insertCell(index + 1, {
        cell_type: 'code',
        source: text,
        metadata: {
          trusted: false
        }
      });
    }
  }