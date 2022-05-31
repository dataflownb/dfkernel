import { Kernel, KernelMessage } from "@jupyterlab/services";
import { Cell, CodeCell, MarkdownCell, AttachmentsCell, RawCell, ICellModel, IAttachmentsCellModel, IInputPrompt } from "@jupyterlab/cells";
import { DataflowInputPrompt } from "./inputarea";
import { IOutputPrompt } from "@jupyterlab/outputarea";
import { DataflowOutputArea, DataflowOutputPrompt } from "@dfnotebook/dfoutputarea";
import { IChangedArgs } from "@jupyterlab/coreutils";
import { ISessionContext } from "@jupyterlab/apputils";
import { JSONObject } from "@lumino/coreutils";

// FIXME need base cell to redo it's input prompt to match dataflow
// does not use content factory :(

function setPromptModel(cell: Cell) {
    //@ts-expect-error
    (cell._input.prompt as DataflowInputPrompt).model = cell.model;
}

export class DataflowCell<T extends ICellModel = ICellModel> extends Cell<T> {
    constructor(options: Cell.IOptions<T>) {
        super({contentFactory: DataflowCell.defaultContentFactory, ...options});
        setPromptModel(this);
    }
}

export namespace DataflowCell {
    export class ContentFactory extends Cell.ContentFactory {
        /**
         * Create an input prompt.
         */
        createInputPrompt(): IInputPrompt {
            return new DataflowInputPrompt();
        }
    
        /**
         * Create the output prompt for the widget.
         */
        createOutputPrompt(): IOutputPrompt {
            return new DataflowOutputPrompt();
        }
    }
}

export class DataflowMarkdownCell extends MarkdownCell {
    constructor(options: MarkdownCell.IOptions) {
        super({contentFactory: DataflowCell.defaultContentFactory, ...options});
        setPromptModel(this);
    }
}

export class DataflowRawCell extends RawCell {
    constructor(options: RawCell.IOptions) {
        super({contentFactory: DataflowCell.defaultContentFactory, ...options});
        setPromptModel(this);
    }
}

export abstract class DataflowAttachmentsCell<T extends IAttachmentsCellModel> extends AttachmentsCell<T> {
    constructor(options: Cell.IOptions<T>) {
        super({contentFactory: DataflowCell.defaultContentFactory, ...options});
        setPromptModel(this);
    }
}

export class DataflowCodeCell extends CodeCell {
    constructor(options: CodeCell.IOptions) {
        super({contentFactory: DataflowCell.defaultContentFactory, ...options});
        setPromptModel(this);
        (this.outputArea as DataflowOutputArea).cellId = this.model.id.replace(/-/g, '').substring(0, 8);
    }

    public setPromptToId() {
        this.setPrompt(`${this.model.id.substring(0, 8) || ''}`);
    }

    initializeState(): this {
        super.initializeState();
        this.setPromptToId()
        return this;
    }

    protected onStateChanged(model: ICellModel, args: IChangedArgs<any>): void {
        super.onStateChanged(model, args);
        switch (args.name) {
            case 'executionCount':
                this.setPromptToId();
                break;
            default:
                break;
        }
    }
}

export namespace DataflowCodeCell {
 /**
   * Execute a cell given a client session.
   */
  export async function execute(
    cell: DataflowCodeCell,
    sessionContext: ISessionContext,
    metadata?: JSONObject,
    dfData?: JSONObject,
    cellIdWidgetMap?: {[key:string]: CodeCell}
  ): Promise<KernelMessage.IExecuteReplyMsg | void> {
    const model = cell.model;
    const code = model.value.text;
    if (!code.trim() || !sessionContext.session?.kernel) {
      model.clearExecution();
      return;
    }
    const cellId = { cellId: model.id };
    metadata = {
      ...model.metadata.toJSON(),
      ...metadata,
      ...cellId
    };
    const { recordTiming } = metadata;
    model.clearExecution();
    cell.outputHidden = false;
    cell.setPrompt('*');
    model.trusted = true;
    let future:
      | Kernel.IFuture<
          KernelMessage.IExecuteRequestMsg,
          KernelMessage.IExecuteReplyMsg
        >
      | undefined;
    try {
      const msgPromise = DataflowOutputArea.execute(
          code,
          cell.outputArea,
          sessionContext,
          metadata,
          dfData,
          cellIdWidgetMap
      );
      // cell.outputArea.future assigned synchronously in `execute`
      if (recordTiming) {
        const recordTimingHook = (msg: KernelMessage.IIOPubMessage) => {
          let label: string;
          switch (msg.header.msg_type) {
            case 'status':
              label = `status.${
                (msg as KernelMessage.IStatusMsg).content.execution_state
              }`;
              break;
            case 'execute_input':
              label = 'execute_input';
              break;
            default:
              return true;
          }
          // If the data is missing, estimate it to now
          // Date was added in 5.1: https://jupyter-client.readthedocs.io/en/stable/messaging.html#message-header
          const value = msg.header.date || new Date().toISOString();
          const timingInfo: any = Object.assign(
            {},
            model.metadata.get('execution')
          );
          timingInfo[`iopub.${label}`] = value;
          model.metadata.set('execution', timingInfo);
          return true;
        };
        cell.outputArea.future.registerMessageHook(recordTimingHook);
      } else {
        model.metadata.delete('execution');
      }

      const clearOutput = (msg: KernelMessage.IIOPubMessage) => {
        switch (msg.header.msg_type) {
          case 'execute_input':
            const executionCount = (msg as KernelMessage.IExecuteInputMsg).content
                .execution_count;
            if (executionCount !== null) {
              const cellId = executionCount.toString(16).padStart(8, '0');
              console.log('EXECUTE INPUT:', cellId);
              if (cellIdWidgetMap) {
                const cellWidget = cellIdWidgetMap[cellId];
                cellWidget.model.value.text = (msg as KernelMessage.IExecuteInputMsg).content.code;
                const outputArea = cellWidget.outputArea;
                outputArea.model.clear();
              }
            }
            break;
          default:
            return true;
        }
        return true;
      };
      console.log("REGISTER:", cell, cell.outputArea, cell.outputArea.future);
      cell.outputArea.future.registerMessageHook(clearOutput);

      // Save this execution's future so we can compare in the catch below.
      future = cell.outputArea.future;
      const msg = (await msgPromise)!;
      model.executionCount = msg.content.execution_count;
      if (recordTiming) {
        const timingInfo = Object.assign(
          {},
          model.metadata.get('execution') as any
        );
        const started = msg.metadata.started as string;
        // Started is not in the API, but metadata IPyKernel sends
        if (started) {
          timingInfo['shell.execute_reply.started'] = started;
        }
        // Per above, the 5.0 spec does not assume date, so we estimate is required
        const finished = msg.header.date as string;
        timingInfo['shell.execute_reply'] =
          finished || new Date().toISOString();
        model.metadata.set('execution', timingInfo);
      }
      return msg;
    } catch (e) {
      // If we started executing, and the cell is still indicating this
      // execution, clear the prompt.
      if (future && !cell.isDisposed && cell.outputArea.future === future) {
        // cell.setPrompt('');
        // FIXME is this necessary?
        cell.setPromptToId();
        // cell.setPrompt(`${cell.model.id.substring(0, 8) || ''}`);
      }
      throw e;
    }
  }
}