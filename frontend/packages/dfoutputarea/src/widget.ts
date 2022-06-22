import { OutputArea, IOutputPrompt, OutputPrompt } from "@jupyterlab/outputarea";
import { IOutputModel } from '@jupyterlab/rendermime';
import { ISessionContext } from '@jupyterlab/apputils';
import { Kernel, KernelMessage } from "@jupyterlab/services";
import * as nbformat from '@jupyterlab/nbformat';
import { JSONObject } from '@lumino/coreutils';
import { Panel, Widget } from "@lumino/widgets";

export class DataflowOutputArea extends OutputArea {
  constructor(options: OutputArea.IOptions, cellId: string) {
    super({contentFactory: DataflowOutputArea.defaultContentFactory, ...options});
    this.cellId = cellId;
  }

  /**
  * The cellIdWidgetMap is a hack to map outputs to other cells.
  */
   static cellIdWidgetMap: { [key:string]: Widget } | undefined;

  /*
  * The cell's id
  */
  cellId: string;

  get future(): Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > {
    return super.future;
  }


  set future(
    value: Kernel.IShellFuture<
      KernelMessage.IExecuteRequestMsg,
      KernelMessage.IExecuteReplyMsg
    >
  ) {
    super.future = value
    super.future.onIOPub = this.onIOPub;
  }

  public onIOPub = (msg: KernelMessage.IIOPubMessage) => {
    const msgType = msg.header.msg_type;
    let output: nbformat.IOutput;

    switch (msgType) {
      case 'execute_result':
      case 'display_data':
      case 'stream':
      case 'error':
        output = { ...msg.content, output_type: msgType };
        if (output.execution_count) {
          const cellId = output.execution_count.toString(16).padStart(8, '0');
          console.log("Output Cell IDS:", {cellId, myCellId: this.cellId});
          if(msgType === 'stream') {
            delete output.execution_count;
          }
          if (cellId !== this.cellId) {
            if (DataflowOutputArea.cellIdWidgetMap) {
              console.log("Calling other onIOPub")
              const cellWidget = DataflowOutputArea.cellIdWidgetMap[cellId];
              //@ts-ignore
              const outputArea = cellWidget._output;
              outputArea._onIOPub(msg);
            }
            break;
          }
        }
        //@ts-ignore
        this._onIOPub(msg);
        break;
      default: {
        //@ts-ignore
        this._onIOPub(msg);
        break;
      }
    }
  };  

  protected createOutputItem(model: IOutputModel): Widget | null {
    const panel = super.createOutputItem(model) as Panel;
    if (panel) {
      if (model.metadata['output_tag']) {
        const prompt = panel.widgets[0] as DataflowOutputPrompt;
        prompt.outputTag = model.metadata['output_tag'] as string;
      }
    }
    return panel;
  }
}

export class DataflowOutputPrompt extends OutputPrompt {
  updatePrompt() {
    if (this._outputTag) {
      this.node.textContent = `${this._outputTag}:`;
    } else if (this.executionCount === null) {
      this.node.textContent = '';
    } else {
      const cellId = this.executionCount
          .toString(16)
          .padStart(8, '0');
          // .substr(0, 3);
      this.node.textContent = `[${cellId}]:`;
    }
  }

  get executionCount(): nbformat.ExecutionCount {
    return super.executionCount;
  }
  set executionCount(value: nbformat.ExecutionCount) {
    super.executionCount = value;
    this.updatePrompt();
  }

  get outputTag(): string {
    return this._outputTag;
  }

  set outputTag(value: string) {
    this._outputTag = value;
    this.updatePrompt();
  }

  private _outputTag: string = '';
}

export namespace DataflowOutputArea {
  export async function execute(
    code: string,
    output: OutputArea,
    sessionContext: ISessionContext,
    metadata?: JSONObject,
    dfData?: JSONObject,
    cellIdWidgetMap?: {[key:string]: Widget}
  ): Promise<KernelMessage.IExecuteReplyMsg | undefined> {
    // Override the default for `stop_on_error`.
    let stopOnError = true;
    if (
      metadata &&
      Array.isArray(metadata.tags) &&
      metadata.tags.indexOf('raises-exception') !== -1
    ) {
      stopOnError = false;
    }
    if (dfData === undefined) {
      // FIXME not sure if this works or not...
      dfData = {} as JSONObject;
    }
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code,
      stop_on_error: stopOnError,
      user_expressions: { __dfkernel_data__: dfData } as JSONObject
    };

    const kernel = sessionContext.session?.kernel;
    if (!kernel) {
      throw new Error('Session has no kernel.');
    }
    const future = kernel.requestExecute(content, false, metadata);
    output.future = future;

    DataflowOutputArea.cellIdWidgetMap = cellIdWidgetMap;

    return future.done;
  }

  /**
   * The default implementation of `IContentFactory`.
   */
   export class ContentFactory extends OutputArea.ContentFactory {
    /**
     * Create the output prompt for the widget.
     */
    createOutputPrompt(): IOutputPrompt {
      return new DataflowOutputPrompt();
    }
  }

  export const defaultContentFactory = new ContentFactory();
}