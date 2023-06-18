import { DepView } from './depview';
import { Minimap } from './minimap';

//UUID length has been changed need to compensate for that
const uuid_length = 8;


// @ts-ignore
    declare global {
    interface Array<T> {
        setadd(item: T): Array<T>;
        }
    }

        /** @method this is a set addition method for dependencies */
    // @ts-ignore
    Array.prototype.setadd = function (item) {
        let that = this;
        if(that.indexOf(item) < 0){
            that.push(item);
        }
    };

class GraphManager {

    public graphs: {[index: string]:any} ;
    current_graph: string;
    depview: any;
    minimap: any;
    depWidget: any;
    miniWidget: any;
    activeID: string;
    tracker: any;
    previousActive: string;

    constructor(graphs?:{}){
        this.graphs = graphs || {};
        this.current_graph = "None";
        this.depview = new DepView();
        this.minimap = new Minimap();
        this.previousActive = "None";
    }

    getProperty = function(prop: string){
    if (prop in this.graphs) {
        // @ts-ignore
        return this.graphs[prop]
    }
    return ''
    }


    set_tracker = function(tracker:any){
        this.tracker = tracker;
        this.minimap.setTracker(this.tracker);
        this.depview.setTracker(this.tracker);
    }

    /** @method updates the activate graph and calls the update views method */
    update_graph = function(graph:string){
        if(graph != this.current_graph){
            this.current_graph = graph;
            this.depview.dfgraph = this.graphs[graph];
            this.minimap.dfgraph = this.graphs[graph];
            this.update_dep_views(true);
        }
    }

    update_active = function(activeid?:string,prevActive?:any){
        this.activeID = activeid || "none";
        this.previousActive = prevActive || "none";
        //FIXME: Add depviewer active cell code
        //         if(this.depWidget.is_open){
        //             console.log("Update dep viewer here");
        //         }
        if(this.miniWidget.is_open){
            this.minimap.updateActiveByID(activeid);
        }
    }

    mark_stale = function(uuid:string){
        this.graphs[this.current_graph].update_stale(uuid);
        this.minimap.update_states();
    }

    revert_stale = function(uuid:string){
        this.graphs[this.current_graph].update_fresh(uuid,true);
        this.minimap.update_states();
    }

    get_stale = function(uuid:string){
        return this.graphs[this.current_graph].states[uuid];
    }

    get_active = function(){
        return this.previousActive;
    }

    get_text = function(uuid:string){
        return this.graphs[this.current_graph].cell_contents[uuid];
    }

    update_order = function(neworder:any){

        if(!(this.current_graph in this.graphs)){
            return;
        }
        this.graphs[this.current_graph].update_order(neworder);
        let modifiedorder = neworder.map((cellid:any) => cellid.replace(/-/g, '').substr(0, 8) as string);
        this.minimap.updateOrder(modifiedorder);
        this.depview.updateOrder(modifiedorder);
        //FIXME: Make this only update for minimap
        console.log("Updating dependency views");
        this.update_dep_views(true);
    }

    /** @method updates all viewers based on if they're open or not */
    // view flag is based on if it's a new view or the same view
    update_dep_views = function(newView:boolean){
    if(this.miniWidget.is_open){
//      Add transition code here
      if(newView){
        this.minimap.clearMinimap();
      }
      this.minimap.startMinimapCreation();

    }
    if(this.depWidget.is_open){
      if(newView){
        this.depview.startGraphCreation();
      }
      else{
        let g = this.depview.create_node_relations(this.depview.globaldf, this.depview.globalselect);
        this.depview.create_graph(g);
      }
    }


    }


}



export class Graph {


    upstream_list: {};
    was_changed: boolean;
    cells: any;
    nodes: any;
    uplinks: any;
    downlinks: any;
    internal_nodes: any;
    downstream_lists: any;
    depview: any;
    minimap: any;
    cell_contents : any;
    cell_order: any;
    states: any;
    executed: any;

    /*
    * Create a graph to contain all inner cell dependencies
    */
    constructor({cells = [],nodes = [],uplinks={},downlinks={}, internal_nodes= {}, all_down= {}, cell_contents= {}}:{cells?: string[], nodes?: string[], uplinks?: {}, downlinks?: {}, internal_nodes?: {}, all_down?: {}, cell_contents?: {}} = {}, states?: {}) {
        let that = this;
        this.was_changed = false;
        this.cells = cells || [];
        this.nodes = nodes || [];
        this.uplinks = uplinks || {};
        this.downlinks = downlinks || {};
        this.internal_nodes = internal_nodes || {};
        this.cell_contents = cell_contents || {};
        this.cell_order = [];
        //Cache downstream lists
        this.downstream_lists = all_down || {};
        this.upstream_list = {};
        this.states = states || {};
        this.executed = {};
        if(that.cells.length > 1){
                that.cells.forEach(function(uuid:string){
                    that.states[uuid] = "Stale";
                    that.executed[uuid] = false;
                });
        }
    }

    /** @method update_stale updates the stale states in the graph */
    update_stale(uuid:string){
        this.states[uuid] = "Changed";
        if(uuid in this.downlinks){
            this.all_downstream(uuid).forEach((duuid:string) => (this.states[duuid] = "Upstream Stale"));
        }
    }

    /** @method get_text **/
    get_text = function(uuid:string){
        if(uuid in this.cell_contents){ return this.cell_contents[uuid];}
        return '';
    }

    /** @method update_fresh updates the stale states in the graph */
    update_fresh(uuid:string,revert:boolean){
        let that = this;
        //Make sure that we don't mark non executed cells as fresh
        if(revert && !that.executed[uuid]){
            return;
        }
        that.states[uuid] = "Fresh";
        that.executed[uuid] = true;
        //We have to execute upstreams either way
        console.log(that.uplinks[uuid]);
        Object.keys(that.uplinks[uuid]).forEach(function(upuuid:string){
            that.states[upuuid] = "Fresh";
        });
        
        if(revert == true){
            //Restore downstream statuses
            that.all_downstream(uuid).forEach(function(duuid:string){
                if(that.upstream_fresh(duuid) && that.states[duuid] == "Upstream Stale"){
                    that.states[duuid] = "Fresh";
                }
            })
        }

    }

    /** @method upstream_fresh checks to see if everything upstream from a cell is fresh or not */
    upstream_fresh(uuid:string){
        let that = this;
        return Object.keys(that.get_all_upstreams(uuid)).reduce(function(flag:boolean,upuuid:string){return flag && that.states[upuuid] == "Fresh";},true);
    }


    /** @method update_graph */
    update_graph(this:Graph,cells: any, nodes: never[], uplinks: any, downlinks: never[], uuid: string, all_ups: any, internal_nodes: any){
        let that:Graph = this;
//         if(that.depview.is_open === false){
//             that.was_changed = true;
//         }
        that.cells = cells;
        that.nodes[uuid] = nodes || [];
        if(uuid in that.uplinks){
            Object.keys(that.uplinks[uuid]).forEach(function (uplink) {
                that.downlinks[uplink] = [];
            });
        }
        that.uplinks[uuid] = uplinks;
        that.downlinks[uuid] = downlinks || [];
        that.internal_nodes[uuid] = internal_nodes;
        that.update_dep_lists(all_ups,uuid);
        that.update_fresh(uuid,false);
        //Shouldn't need the old way of referencing
        //that.minimap.update_edges();
        //celltoolbar.CellToolbar.rebuild_all();
    };


    update_order = function(neworder:any){
        console.log(neworder);
        this.cell_order = neworder;
    }

    /** @method removes a cell entirely from the graph **/
    remove_cell = function(this:Graph,uuid: string){
        let that:Graph = this;
        let cell_index = that.cells.indexOf(uuid);
        if(cell_index > -1){
          that.cells.splice(cell_index,1);
          delete that.nodes[uuid];
          delete that.internal_nodes[uuid];
          delete that.downstream_lists[uuid];
          (that.downlinks[uuid] || []).forEach(function (down: any) {
              if(down in that.uplinks && uuid in that.uplinks[down]){
                  delete (that.uplinks[down])[uuid];
              }
          });
          delete that.downlinks[uuid];
          if(uuid in that.uplinks) {
              let uplinks = Object.keys(that.uplinks[uuid]);
                  uplinks.forEach(function (up : any) {
                      let idx = that.downlinks[up].indexOf(uuid);
                      that.downlinks[up].splice(idx,1);
                  });
          }
          delete that.uplinks[uuid];
          if(uuid in that.upstream_list){
              // @ts-ignore
              let all_ups = that.upstream_list[uuid].slice(0);
              // @ts-ignore
              delete that.upstream_list[uuid];
              all_ups.forEach(function (up : any) {
                      //Better to just invalidate the cached list so you don't have to worry about downstreams too
                      delete that.downstream_lists[up];
              });
          }
        }
    };


    /** @method set_internal_nodes */
    set_internal_nodes = function (this:Graph,uuid: string | number, internal_nodes: any){
        this.internal_nodes[uuid] = internal_nodes;
    };


    /** @method recursively yield all downstream deps */
    all_downstream(this:Graph,uuid: string | number){
        let that:Graph = this;
        let visited = new Array();// Array<string> = [];
        let res = new Array();//: Array<string> = [];
        let downlinks = (this.downlinks[uuid] || []).slice(0);
        while(downlinks.length > 0){
            let cid = downlinks.pop();
            visited.setadd(cid);
            res.setadd(cid);
            if(cid in that.downstream_lists)
            {
                that.downstream_lists[cid].forEach(function (pid : string) {
                    res.setadd(pid);
                    visited.setadd(pid);
                });
            }
            else{
                if(cid in that.downlinks) {
                    that.downlinks[cid].forEach(function (pid : string) {
                        if (visited.indexOf(pid) < 0) {
                            downlinks.push(pid);
                        }
                    })
                }
                else{
                    let idx = res.indexOf(cid);
                    res.splice(idx,1);
                }
            }
        }
        that.downstream_lists[uuid] = res;
        return res;
    };


    all_upstream_cell_ids(cid: any) {
        let uplinks = this.get_imm_upstreams(cid);
        let all_cids = new Array();
        while (uplinks.length > 0) {
            let up_cid = uplinks.pop();
            all_cids.setadd(up_cid);
            uplinks = uplinks.concat(this.get_imm_upstreams(up_cid));
        }
        return all_cids;
    };


     /** @method updates all downstream links with downstream updates passed from kernel */
    update_down_links(this:Graph,downupdates: any[]) {
        let that:Graph = this;
        downupdates.forEach(function (t) {
            let uuid = t['key'].substr(0, uuid_length);
            that.downlinks[uuid] = t['data'];
            if(uuid in that.cell_contents && t.data){
                that.downlinks[uuid] = t['data'];
            }
        });
        that.downstream_lists = {};
    };

    /** @method update_code_dict */
    update_cell_contents(this:Graph,cell_contents:any){
        this.cell_contents = cell_contents;
    }


    /** @method update_dep_lists */
    update_dep_lists(this:Graph,all_ups: string | any[], uuid: string | number){
        let that:Graph = this;
    //     let cell = Jupyter.notebook.get_code_cell(uuid);
    //
    //     if(cell.last_msg_id){
    //         cell.clear_df_info();
    //     }
    //
    //     if(that.downlinks[uuid].length > 0){
    //         cell.update_df_list(cell,that.all_downstream(uuid),'downstream');
    //     }
    //
        if(all_ups.length > 0){
           // @ts-ignore
            that.upstream_list[uuid] = all_ups;
    //        cell.update_df_list(cell,all_ups,'upstream');
        }
    };

    /** @method returns the cached all upstreams for a cell with a given uuid */
    get_all_upstreams(uuid: string | number) {
        // @ts-ignore
        return this.upstream_list[uuid];
    };

    /** @method returns upstreams for a cell with a given uuid */
    get_upstreams(this:Graph,uuid: string | number){
        let that:Graph = this;
        return Object.keys(that.uplinks[uuid] || []).reduce(function (arr,uplink) {
           let links = that.uplinks[uuid][uplink].map(function (item: string){
               return uplink === item ? item : uplink+item;}) || [];
            return arr.concat(links);
        },[]);
    };



    /** @method returns single cell based upstreams for a cell with a given uuid */
    get_imm_upstreams(uuid: string | undefined){
        // @ts-ignore
        if (uuid in this.uplinks) {
            // @ts-ignore
            return Object.keys(this.uplinks[uuid]);
        }
        return [];
    };

    get_imm_upstream_names(this:Graph,uuid: string | number | undefined) {
        let arr: never[] = [];
        let that:Graph = this;
        // @ts-ignore
        this.get_imm_upstreams(uuid).forEach(function(up_uuid) {
            // @ts-ignore
            Array.prototype.push.apply(arr, that.uplinks[uuid][up_uuid]);
        });
        return arr;
    };

    get_imm_upstream_pairs(uuid: string | number | undefined) {
        let arr: never[] = [];
        let that:Graph = this;
        // @ts-ignore
        this.get_imm_upstreams(uuid).forEach(function(up_uuid) {
            // @ts-ignore
            Array.prototype.push.apply(arr, that.uplinks[uuid][up_uuid].map(function(v) { return [v, up_uuid];}));
        });
        return arr;
    };


    /** @method returns downstreams for a cell with a given uuid */
    get_downstreams(uuid: string | number) {
        return this.downlinks[uuid];
    };

    /** @method returns the cached all upstreams for a cell with a given uuid */
    get_internal_nodes(uuid: string | number) {
        return this.internal_nodes[uuid] || [];
    };

    /** @method returns all nodes for a cell*/
    get_nodes(this:Graph,uuid: string){
        let that:Graph = this;
        if (uuid in that.nodes) {
            if ((that.nodes[uuid] || []).length > 0) {
                return that.nodes[uuid];
            }
        }
        return [];
    };

    /** @method returns all cells on kernel side*/
    get_cells = function(this:Graph){
        return this.cells;
    };

}

export const Manager = new GraphManager();




