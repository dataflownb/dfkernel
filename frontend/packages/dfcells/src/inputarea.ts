import { ICellModel, IInputPrompt, InputArea, InputPrompt } from "@jupyterlab/cells"

export class DataflowInputArea extends InputArea {
    // kind of annoying as model still needs to be set later
    constructor(options: InputArea.IOptions) {
        super({contentFactory: DataflowInputArea.defaultContentFactory, ...options});
        (this.prompt as DataflowInputPrompt).model = this.model;
    }

    get prompt() : DataflowInputPrompt {
        //@ts-ignore
        return this._prompt;
    }

    set prompt(value: DataflowInputPrompt) {
        (value as DataflowInputPrompt).model = this.model;
        //@ts-ignore
        this._prompt = value
    }

    public addTag(value: string | null) {
        this.model?.metadata.set('tag', value);
        this.prompt.updatePromptNode(this.prompt.executionCount);
    }
}

export namespace DataflowInputArea {

    export class ContentFactory extends InputArea.ContentFactory {
        /**
         * Create an input prompt.
         */
        createInputPrompt(): IInputPrompt {
            return new DataflowInputPrompt();
        }
    }

    export const defaultContentFactory = new ContentFactory({});

}

export class DataflowInputPrompt extends InputPrompt {
    constructor(model: ICellModel | null=null) {
        super();
        this.model = model;
    }

    public updatePromptNode(value: string | null) {
        if (this.model?.metadata.get('tag')) {
            this.node.textContent = `[${this.model.metadata.get('tag')}]:`;
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
            this.updatePromptNode(this.executionCount);    
        }
    }

    private _model: ICellModel | null;
}