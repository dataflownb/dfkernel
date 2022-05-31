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
        var that = this;
        if(that.indexOf(item) < 0){
            that.push(item);
        }
    };

class GraphManager {

    public graphs: {[index: string]:any} ;
    current_graph: string;

    constructor(graphs?:{}){
        this.graphs = graphs || {};
        this.current_graph = "None";
    }

    getProperty = function(prop: string){
    if (prop in this.graphs) {
        // @ts-ignore
        return this.graphs[prop]
    }
    return ''
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

    /*
    * Create a graph to contain all inner cell dependencies
    */
    constructor(cells?: never[], nodes?: never[], uplinks?: {}, downlinks?: {}, internal_nodes?: {}, all_down?: {}, cell_contents?: {}) {
        this.was_changed = false;
        this.cells = cells || [];
        this.nodes = nodes || [];
        this.uplinks = uplinks || {};
        this.downlinks = downlinks || {};
        this.internal_nodes = internal_nodes || {};
        this.cell_contents = cell_contents || {};

        //Cache downstream lists
        this.downstream_lists = all_down || {};
        this.upstream_list = {};
        this.depview = new DepView(this);
        this.minimap = new Minimap(this);
    }


    /** @method update_graph */
    update_graph(this:Graph,cells: any, nodes: never[], uplinks: any, downlinks: never[], uuid: string, all_ups: any, internal_nodes: any){
        var that:Graph = this;
        if(that.depview.is_open === false){
            that.was_changed = true;
        }
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
        that.minimap.update_edges(this.downlinks);
        //celltoolbar.CellToolbar.rebuild_all();
    };

    /** @method removes a cell entirely from the graph **/
    remove_cell = function(this:Graph,uuid: string){
        var that:Graph = this;
        var cell_index = that.cells.indexOf(uuid);
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
              var uplinks = Object.keys(that.uplinks[uuid]);
                  uplinks.forEach(function (up : any) {
                      var idx = that.downlinks[up].indexOf(uuid);
                      that.downlinks[up].splice(idx,1);
                  });
          }
          delete that.uplinks[uuid];
          if(uuid in that.upstream_list){
              // @ts-ignore
              var all_ups = that.upstream_list[uuid].slice(0);
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




    /** @method update_graph */
    update_dep_view() {
    var depview = this.depview;
    if(depview.is_open){
        var g = depview.create_node_relations(depview.globaldf, depview.globalselect);
        depview.create_graph(g);
    }
    };

    /** @method recursively yield all downstream deps */
    all_downstream(this:Graph,uuid: string | number){
        var that:Graph = this;
        let visited = new Array();// Array<string> = [];
        var res = new Array();//: Array<string> = [];
        var downlinks = (this.downlinks[uuid] || []).slice(0);
        while(downlinks.length > 0){
            var cid = downlinks.pop();
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
                    var idx = res.indexOf(cid);
                    res.splice(idx,1);
                }
            }
        }
        that.downstream_lists[uuid] = res;
        return res;
    };


    all_upstream_cell_ids(cid: any) {
        //var that = this;
        var uplinks = this.get_imm_upstreams(cid);
        var all_cids = new Array();
        while (uplinks.length > 0) {
            var up_cid = uplinks.pop();
            all_cids.setadd(up_cid);
            uplinks = uplinks.concat(this.get_imm_upstreams(up_cid));
        }
        return all_cids;
    };


     /** @method updates all downstream links with downstream updates passed from kernel */
    update_down_links(this:Graph,downupdates: any[]) {
        var that:Graph = this;
        downupdates.forEach(function (t) {
            var uuid = t['key'].substr(0, uuid_length);
            that.downlinks[uuid] = t['data'];
            if(uuid in that.cell_contents && t.data){
                that.downlinks[uuid] = t['data'];
            }
        });
        that.downstream_lists = {};
    };

    /** @method update_code_dict */
    update_cell_contents(this:Graph,cell_contents:any){
        //var that:Graph = this;
        this.cell_contents = cell_contents;
        this.minimap.update_cells(cell_contents);
    }


    /** @method update_dep_lists */
    update_dep_lists(this:Graph,all_ups: string | any[], uuid: string | number){
        var that:Graph = this;
    //     var cell = Jupyter.notebook.get_code_cell(uuid);
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
        var that:Graph = this;
        return Object.keys(that.uplinks[uuid] || []).reduce(function (arr,uplink) {
           var links = that.uplinks[uuid][uplink].map(function (item: string){
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
        var arr: never[] = [];
        var that:Graph = this;
        // @ts-ignore
        this.get_imm_upstreams(uuid).forEach(function(up_uuid) {
            // @ts-ignore
            Array.prototype.push.apply(arr, that.uplinks[uuid][up_uuid]);
        });
        return arr;
    };

    get_imm_upstream_pairs(uuid: string | number | undefined) {
        var arr: never[] = [];
        var that:Graph = this;
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
        var that:Graph = this;
        console.log(uuid);
        if (uuid in that.nodes) {
            if ((that.nodes[uuid] || []).length > 0) {
                console.log(that.nodes[uuid]);
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

//let DfGraph = new Graph();
//export const DfGraph = new Graph();
export const Manager = new GraphManager();




