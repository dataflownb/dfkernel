import { InputPrompt, ICellModel, InputArea, IInputPrompt } from "@jupyterlab/cells"

export class DataflowInputArea extends InputArea {
    // kind of annoying as model still needs to be set later
    constructor(options: InputArea.IOptions) {
        super({contentFactory: DataflowInputArea.defaultContentFactory, ...options});
    }

    get prompt() {
        //@ts-ignore
        return super._prompt;
    }

    set prompt(value: IInputPrompt) {
        //@ts-ignore
        super._prompt = prompt
    }
}

export namespace DataflowInputArea {

    export class DataflowContentFactory extends InputArea.ContentFactory {
        /**
         * Create an input prompt.
         */
        createDataflowInputPrompt(model: ICellModel | null): IInputPrompt {
            return new DataflowInputPrompt(model);
        }
    }

    export const defaultContentFactory = new DataflowContentFactory({});

}


export class DataflowInputPrompt extends InputPrompt {
    constructor(model: ICellModel | null=null) {
        super();
        this._model = model;
    }

    public updatePromptNode(value: string | null) {
        if (this.model?.metadata.get('tag')) {
            this.node.textContent = `[${this.model.metadata.get('tag')}]`;
        } else if (value === null) {
            this.node.textContent = ' ';
        } else {
            this.node.textContent = `[${value || ' '}]:`;
        }
    }

    /**
     * The execution count for the prompt.
     */
    get executionCount(): string | null {
        return super.executionCount;
    }
    set executionCount(value: string | null) {
        super.executionCount = value;
        this.updatePromptNode(value);
    }

    get model(): ICellModel | null {
        return this._model
    }

    set model(value: ICellModel | null) {
        this._model = value;
        if (this._model) {
            this.node.addEventListener('mouseup', event => {
                event.stopPropagation();
                const value = prompt("Tag this cell:", "");
                this._model?.metadata.set('tag', value);
                this.node.textContent = `[${value || ' '}]:`;
            })
            this.updatePromptNode(this.executionCount);    
        }
    }

    private _model: ICellModel | null;
}