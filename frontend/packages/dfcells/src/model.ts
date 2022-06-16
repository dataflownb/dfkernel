import { CellModel, AttachmentsCellModel, RawCellModel, MarkdownCellModel, CodeCellModel } from "@jupyterlab/cells";
// import { IOutputAreaModel } from "@jupyterlab/outputarea";
// import { JSONObject } from "@lumino/coreutils";

// type GConstructor<T = {}> = new (...args: any[]) => T;
// //type GConstructor<T = {}> = new (options: CellModel.IOptions) => T;
// type CellModelLike = GConstructor<CellModel>;

// function SetIdMixin<T extends CellModelLike>(Base: T) {
//     return class DataflowCellModelBase extends Base {
//         constructor(...args: any[]) {
//             super(args[0]);
//             const metadata = this.modelDB.getValue('metadata') as JSONObject;
//             metadata['dfnotebook'] = {};
//             metadata['dfnotebook']['id'] = this.id;
//         }
//     }
// }

// const DataflowCellModel = SetIdMixin(CellModel);
// const DataflowCodeCellModel = SetIdMixin(CodeCellModel);
// export { DataflowCellModel, DataflowCodeCellModel};

function setId(model: CellModel) {
    // FIXME don't need this???
    //
    // const metadata = model.modelDB.getValue('metadata') as JSONObject;
    // metadata['dfnotebook'] = {};
    // metadata['dfnotebook']['id'] = model.id;
}

export class DataflowCellModel extends CellModel {
    constructor(options: CellModel.IOptions) {
        super(options);
        setId(this);
    }
}

export class DataflowAttachmentsCellModel extends AttachmentsCellModel {
    constructor(options: AttachmentsCellModel.IOptions) {
        super(options);
        setId(this);
    }
}

export class DataflowRawCellModel extends RawCellModel {
    constructor(options: CellModel.IOptions) {
        super(options);
        setId(this);
    }
}

export class DataflowMarkdownCellModel extends MarkdownCellModel {
    constructor(options: CellModel.IOptions) {
        super(options);
        setId(this);
    }
}

export class DataflowCodeCellModel extends CodeCellModel {
    constructor(options: CodeCellModel.IOptions) {
        super(options);
        setId(this);
    }
}

// export namespace DataflowCodeCellModel {
//   /**
//    * The default implementation of an `IContentFactory`.
//    */
//    export class ContentFactory extends CodeCellModel.ContentFactory {
//     /**
//      * Create an output area.
//      */
//     createOutputArea(options: IOutputAreaModel.IOptions): IOutputAreaModel {
//       return new OutputAreaModel(options);
//     }
//   }

//   /**
//    * The shared `ContentFactory` instance.
//    */
//   export const defaultContentFactory = new ContentFactory();
// }