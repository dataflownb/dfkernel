import { DepView } from './depview';
import { Minimap } from './minimap';

//UUID length has been changed need to compensate for that
const uuidLength = 8;

// @ts-ignore
declare global {
  interface Array<T> {
    setAdd(item: T): Array<T>;
  }
}

/** @method this is a set addition method for dependencies */
// @ts-ignore
Array.prototype.setAdd = function (item) {
  let that = this;
  if (that.indexOf(item) < 0) {
    that.push(item);
  }
};

class GraphManager {
  public graphs: { [index: string]: any };
  currentGraph: string;
  depview: any;
  minimap: any;
  depWidget: any;
  miniWidget: any;
  activeID: string;
  tracker: any;
  previousActive: string;

  constructor(graphs?: {}) {
    this.graphs = graphs || {};
    this.currentGraph = 'None';
    this.depview = new DepView();
    this.minimap = new Minimap();
    this.previousActive = 'None';
  }

  getProperty = function (prop: string) {
    if (prop in this.graphs) {
      // @ts-ignore
      return this.graphs[prop];
    }
    return '';
  };

  setTracker = function (tracker: any) {
    this.tracker = tracker;
    this.minimap.setTracker(this.tracker);
    this.depview.setTracker(this.tracker);
  };

  /** @method updates the activate graph and calls the update views method */
  updateGraph = function (graph: string) {
    if (graph == 'None') {
      return;
    }
    this.currentGraph = graph;
    this.depview.dfgraph = this.graphs[graph];
    this.minimap.setGraph(this.graphs[graph]);
    this.updateDepViews(true);
  };

  updateActive = function (activeid?: string, prevActive?: any) {
    this.activeID = activeid || 'none';
    this.previousActive = prevActive || 'none';
    //FIXME: Add depviewer active cell code
    //         if(this.depWidget.is_open){
    //             console.log("Update dep viewer here");
    //         }
    if (this.miniWidget && this.miniWidget.isOpen) {
      this.minimap.updateActiveByID(activeid);
    }
  };

  /** @method attempt to update the active graph using the tracker this is not preferred **/
  updateActiveGraph = function () {
    this.currentGraph =
      this.tracker.currentWidget.sessionContext.session?.id || 'None';
    this.depview.dfgraph = this.graphs[this.currentGraph];
    this.minimap.setGraph(this.graphs[this.currentGraph]);
    this.updateDepViews(true, false, true);
  };

  markStale = function (uuid: string) {
    this.updateActiveGraph();
    if (!(this.currentGraph in this.graphs)) {
      return;
    }
    this.graphs[this.currentGraph].updateStale(uuid);
    if (this.miniWidget.isOpen) {
        this.minimap.updateStates();
    }
  };

  revertStale = function (uuid: string) {
    this.graphs[this.currentGraph].updateFresh(uuid, true);
    if(this.miniWidget.isOpen){
        this.minimap.updateStates();
    }
  };

  getStale = function (uuid: string) {
    return this.graphs[this.currentGraph].states[uuid];
  };

  getActive = function () {
    return this.previousActive;
  };

  getText = function (uuid: string) {
    this.updateActiveGraph();
    if (!(this.currentGraph in this.graphs)) {
      return '';
    }
    return this.graphs[this.currentGraph].cellContents[uuid];
  };

  updateOrder = function (neworder: any) {
    this.updateActiveGraph();
    if (!(this.currentGraph in this.graphs)) {
      return;
    }
    this.graphs[this.currentGraph].updateOrder(neworder);
    let modifiedorder = neworder.map(
      (cellid: any) => cellid.replace(/-/g, '').substr(0, 8) as string
    );
    this.minimap.updateOrder(modifiedorder);
    this.depview.updateOrder(modifiedorder,true);
    this.updateDepViews(true, true);
  };

  // Utility function to create an empty graph in case one doesn't exist
  createGraph = function (sess:string){
    this.graphs[sess] = new Graph();
  }

  /** @method updates all viewers based on if they're open or not */
  // view flag is based on if it's a new view or the same view
  updateDepViews = function (
    newView: boolean,
    mini: boolean = false,
    mini2: boolean = false
  ) {
    if (this.miniWidget && this.miniWidget.isOpen) {
      if (mini2) {
        return;
      }
      if (newView) {
        this.minimap.clearMinimap();
      }
      this.minimap.startMinimapCreation();
    }
    if (this.depwidget && this.depWidget.isOpen && !mini) {
      if (newView) {
        this.depview.startGraphCreation();
      } else {
        let g = this.depview.createNodeRelations(
          this.depview.globaldf,
          this.depview.globalselect
        );
        this.depview.createGraph(g);
      }
    }
  };
}

export class Graph {
  upstreamList: {};
  wasChanged: boolean;
  cells: any;
  nodes: any;
  uplinks: any;
  downlinks: any;
  internalNodes: any;
  downstreamLists: any;
  depview: any;
  minimap: any;
  cellContents: any;
  cellOrder: any;
  states: any;
  executed: any;

  /*
   * Create a graph to contain all inner cell dependencies
   */
  constructor(
    {
      cells = [],
      nodes = [],
      uplinks = {},
      downlinks = {},
      internalNodes = {},
      allDown = {},
      cellContents = {}
    }: {
      cells?: string[];
      nodes?: string[];
      uplinks?: {};
      downlinks?: {};
      internalNodes?: {};
      allDown?: {};
      cellContents?: {};
    } = {},
    states?: {}
  ) {
    let that = this;
    this.wasChanged = false;
    this.cells = cells || [];
    this.nodes = nodes || [];
    this.uplinks = uplinks || {};
    this.downlinks = downlinks || {};
    this.internalNodes = internalNodes || {};
    this.cellContents = cellContents || {};
    this.cellOrder = [];
    //Cache downstream lists
    this.downstreamLists = allDown || {};
    this.upstreamList = {};
    this.states = states || {};
    this.executed = {};
    if (that.cells.length > 1) {
      that.cells.forEach(function (uuid: string) {
        that.states[uuid] = 'Stale';
        that.executed[uuid] = false;
      });
    }
  }

  /** @method updateStale updates the stale states in the graph */
  updateStale(uuid: string) {
    this.states[uuid] = 'Changed';
    if (uuid in this.downlinks) {
      this.allDownstream(uuid).forEach(
        (duuid: string) => (this.states[duuid] = 'Upstream Stale')
      );
    }
  }

  /** @method getText **/
  getText = function (uuid: string) {
    if (uuid in this.cellContents) {
      return this.cellContents[uuid];
    }
    return '';
  };

  /** @method updateFresh updates the stale states in the graph */
  updateFresh(uuid: string, revert: boolean) {
    let that = this;
    //Make sure that we don't mark non executed cells as fresh
    if (revert && !that.executed[uuid]) {
      return;
    }
    that.states[uuid] = 'Fresh';
    that.executed[uuid] = true;
    //We have to execute upstreams either way
    console.log(that.uplinks[uuid]);
    Object.keys(that.uplinks[uuid]).forEach(function (upuuid: string) {
      that.states[upuuid] = 'Fresh';
    });

    if (revert == true) {
      //Restore downstream statuses
      that.allDownstream(uuid).forEach(function (duuid: string) {
        if (
          that.upstreamFresh(duuid) &&
          that.states[duuid] == 'Upstream Stale'
        ) {
          that.states[duuid] = 'Fresh';
        }
      });
    }
  }

  /** @method upstreamFresh checks to see if everything upstream from a cell is fresh or not */
  upstreamFresh(uuid: string) {
    let that = this;
    return Object.keys(that.getAllUpstreams(uuid)).reduce(function (
      flag: boolean,
      upuuid: string
    ) {
      return flag && that.states[upuuid] == 'Fresh';
    }, true);
  }

  /** @method updateGraph */
  updateGraph(
    this: Graph,
    cells: any,
    nodes: never[],
    uplinks: any,
    downlinks: never[],
    uuid: string,
    allUps: any,
    internalNodes: any
  ) {
    let that: Graph = this;
    //         if(that.depview.isOpen === false){
    //             that.wasChanged = true;
    //         }
    that.cells = cells;
    that.nodes[uuid] = nodes || [];
    if (uuid in that.uplinks && that.uplinks[uuid]) {
      Object.keys(that.uplinks[uuid]).forEach(function (uplink) {
        that.downlinks[uplink] = [];
      });
    }
    that.uplinks[uuid] = uplinks;
    that.downlinks[uuid] = downlinks || [];
    that.internalNodes[uuid] = internalNodes;
    that.updateDepLists(allUps, uuid);
    that.updateFresh(uuid, false);
    //Shouldn't need the old way of referencing
    //that.minimap.updateEdges();
    //celltoolbar.CellToolbar.rebuildAll();
  }

  updateOrder = function (neworder: any) {
    console.log(neworder);
    this.cellOrder = neworder;
  };

  /** @method removes a cell entirely from the graph **/
  removeCell = function (this: Graph, uuid: string) {
    let that: Graph = this;
    let cellIndex = that.cells.indexOf(uuid);
    if (cellIndex > -1) {
      that.cells.splice(cellIndex, 1);
      delete that.nodes[uuid];
      delete that.internalNodes[uuid];
      delete that.downstreamLists[uuid];
      (that.downlinks[uuid] || []).forEach(function (down: any) {
        if (down in that.uplinks && uuid in that.uplinks[down]) {
          delete that.uplinks[down][uuid];
        }
      });
      delete that.downlinks[uuid];
      if (uuid in that.uplinks) {
        let uplinks = Object.keys(that.uplinks[uuid]);
        uplinks.forEach(function (up: any) {
          let idx = that.downlinks[up].indexOf(uuid);
          that.downlinks[up].splice(idx, 1);
        });
      }
      delete that.uplinks[uuid];
      if (uuid in that.upstreamList) {
        // @ts-ignore
        let allUps = that.upstreamList[uuid].slice(0);
        // @ts-ignore
        delete that.upstreamList[uuid];
        allUps.forEach(function (up: any) {
          //Better to just invalidate the cached list so you don't have to worry about downstreams too
          delete that.downstreamLists[up];
        });
      }
    }
  };

  /** @method setInternalNodes */
  setInternalNodes = function (
    this: Graph,
    uuid: string | number,
    internalNodes: any
  ) {
    this.internalNodes[uuid] = internalNodes;
  };

  /** @method recursively yield all downstream deps */
  allDownstream(this: Graph, uuid: string | number) {
    let that: Graph = this;
    let visited: Array<string> = []; // Array<string> = [];
    let res: Array<string> = []; //: Array<string> = [];
    let downlinks = (this.downlinks[uuid] || []).slice(0);
    while (downlinks.length > 0) {
      let cid = downlinks.pop();
      visited.setAdd(cid);
      res.setAdd(cid);
      if (cid in that.downstreamLists) {
        that.downstreamLists[cid].forEach(function (pid: string) {
          res.setAdd(pid);
          visited.setAdd(pid);
        });
      } else {
        if (cid in that.downlinks) {
          that.downlinks[cid].forEach(function (pid: string) {
            if (visited.indexOf(pid) < 0) {
              downlinks.push(pid);
            }
          });
        } else {
          let idx = res.indexOf(cid);
          res.splice(idx, 1);
        }
      }
    }
    that.downstreamLists[uuid] = res;
    return res;
  }

  allUpstreamCellIds(cid: any) {
    let uplinks = this.getImmUpstreams(cid);
    let allCids: Array<string> = [];
    while (uplinks.length > 0) {
      let upCid = uplinks.pop() || '';
      allCids.setAdd(upCid);
      uplinks = uplinks.concat(this.getImmUpstreams(upCid));
    }
    return allCids;
  }

  /** @method updates all downstream links with downstream updates passed from kernel */
  updateDownLinks(this: Graph, downupdates: any[]) {
    let that: Graph = this;
    downupdates.forEach(function (t) {
      let uuid = t['key'].substr(0, uuidLength);
      that.downlinks[uuid] = t['data'];
      if (uuid in that.cellContents && t.data) {
        that.downlinks[uuid] = t['data'];
      }
    });
    that.downstreamLists = {};
  }

  /** @method updateCodeDict */
  updateCellContents(this: Graph, cellContents: any) {
    this.cellContents = cellContents;
  }

  /** @method updateDepLists */
  updateDepLists(this: Graph, allUps: string | any[], uuid: string | number) {
    let that: Graph = this;
    //     let cell = Jupyter.notebook.getCodeCell(uuid);
    //
    //     if(cell.last_msg_id){
    //         cell.clear_df_info();
    //     }
    //
    //     if(that.downlinks[uuid].length > 0){
    //         cell.updateDfList(cell,that.allDownstream(uuid),'downstream');
    //     }
    //
    if (allUps == undefined){ return; }

    if (allUps.length > 0) {
      // @ts-ignore
      that.upstreamList[uuid] = allUps;
      //        cell.updateDfList(cell,allUps,'upstream');
    }
  }

  /** @method returns the cached all upstreams for a cell with a given uuid */
  getAllUpstreams(uuid: string | number) {
    // @ts-ignore
    return this.upstreamList[uuid];
  }

  /** @method returns upstreams for a cell with a given uuid */
  getUpstreams(this: Graph, uuid: string | number) {
    let that: Graph = this;
    return Object.keys(that.uplinks[uuid] || []).reduce(function (arr, uplink) {
      let links =
        that.uplinks[uuid][uplink].map(function (item: string) {
          return uplink === item ? item : uplink + item;
        }) || [];
      return arr.concat(links);
    }, []);
  }

  /** @method returns single cell based upstreams for a cell with a given uuid */
  getImmUpstreams(uuid: string | undefined) {
    // @ts-ignore
    if (uuid in this.uplinks) {
      // @ts-ignore
      return Object.keys(this.uplinks[uuid]);
    }
    return [];
  }

  getImmUpstreamNames(this: Graph, uuid: string | number | undefined) {
    let arr: never[] = [];
    let that: Graph = this;
    // @ts-ignore
    this.getImmUpstreams(uuid).forEach(function (upUuid) {
      // @ts-ignore
      Array.prototype.push.apply(arr, that.uplinks[uuid][upUuid]);
    });
    return arr;
  }

  getImmUpstreamPairs(uuid: string | number | undefined) {
    let arr: never[] = [];
    let that: Graph = this;
    if (uuid !== undefined) {
      this.getImmUpstreams(uuid.toString()).forEach(function (upUuid) {
        Array.prototype.push.apply(
          arr,
          that.uplinks[uuid][upUuid].map(function (v : any) {
            return [v, upUuid];
          })
        );
      });
    }
    return arr;
  }

  /** @method returns downstreams for a cell with a given uuid */
  getDownstreams(uuid: string | number) {
    return this.downlinks[uuid];
  }

  /** @method returns the cached all upstreams for a cell with a given uuid */
  getInternalNodes(uuid: string | number) {
    return this.internalNodes[uuid] || [];
  }

  /** @method returns all nodes for a cell*/
  getNodes(this: Graph, uuid: string) {
    let that: Graph = this;
    if (uuid in that.nodes) {
      if ((that.nodes[uuid] || []).length > 0) {
        return that.nodes[uuid];
      }
    }
    return [];
  }

  /** @method returns all cells on kernel side*/
  getCells = function (this: Graph) {
    return this.cells;
  };
}

export const Manager = new GraphManager();
