import * as d3 from "d3";
import $ from "jquery";
import '@hpcc-js/wasm';
import Writer from "graphlib-dot";
import { graphviz, GraphvizOptions } from "d3-graphviz";
import * as GraphLib from "graphlib";


//UUID length has been changed need to compensate for that
const uuid_length = 8;


const defaultOptions: GraphvizOptions = {
  height: 500,
  width: 500,
  scale: 1,
  tweenPrecision: 1,
  engine: "dot",
  keyMode: "title",
  convertEqualSidedPolygons: false,
  fade: false,
  growEnteringEdges: false,
  fit: true,
  tweenPaths: false,
  tweenShapes: false,
  useWorker: false,
  zoom: false
};


export class DepView {

    is_created: boolean;
    is_open: boolean;
    dataflow: boolean;
    selected: boolean;
    done_rendering: boolean;
    debug_mode: boolean;
    parentdiv: any;
    side_panel: any;
    nodespanel: any;
    tabular: any;
    execute_panel: any;
    labelstyles: string;
    cell_label: string;
    cell_links: any[];
    cell_list: any[];
    cell_child_nums: any[];
    output_nodes: any[];
    active_cell: string;
    dfgraph: any;
    dotgraph: any[];
    depdiv: any;
    svg: any;
    widget: any;



    constructor(dfgraph?: any, parentdiv?: any, labelstyles?: string) {
         //Flags
        this.is_open = false;
        this.dataflow = true;
        this.selected = false;
        this.done_rendering = false;
        this.is_created = false;

        //Turn on console logs
        this.debug_mode = false;

        //Divs and Div related variables
        this.parentdiv = parentdiv || 'div#depview';
        this.depdiv = null;
        this.side_panel = null;
        this.nodespanel = null;
        this.svg = null;
        this.tabular = null;
        this.execute_panel = null;
        //Label Styles should be set in text so that GraphViz can properly size the nodes
        this.labelstyles = labelstyles || 'font-family: monospace; fill: #D84315; font-size: 1.3em;';

        //Divs are created and defined in here
        //this.create_dep_div();

        //This has been largely factored out but this provides the option to change the label of a cell
        this.cell_label = "";

        this.cell_links = [];
        this.cell_list = [];
        this.cell_child_nums = [];
        this.output_nodes = [];
        this.active_cell = '';

        this.dfgraph = dfgraph;
        //console.log(NotebookTools);

        this.dotgraph = [];

        //this.bind_events();
    }
//
//         /** @method bind_events */
    //FIXME: Figure out Jupyter.notebook equivalent here
//     bind_events = function () {
//         var that = this;
//         var nb = Jupyter.notebook;
//
//         nb.events.on('create.Cell', function(evt,cell) {
//             if(that.is_open){
//                 that.update_cell_lists();
//             }
//         });
//         nb.events.on('select.Cell', function(){
//             var cell = Jupyter.notebook.get_selected_cell();
//            if(cell.cell_type === 'code' && that.is_open){
//                that.set_details(cell.uuid);
//            }
//         });
//         nb.events.on('delete.Cell',function (evt,cell) {
//             if(that.is_open){
//                 that.decorate_cell(cell.cell.uuid,'deleted-cell',true);
//             }
//         });
//     };
//
    /** @method closes the depviewer **/
    close_div = function(){
        this.is_open = false;
        this.depdiv.style.display = "none";
            d3.select(this.parentdiv).transition().delay(100).style('height','0vh');
            d3.select('.end_space').transition().delay(100).style('height','0vh');
    };
//
//     /** @method closes the depviewer and scrolls to the currently selected cell **/
//     close_and_scroll = function () {
//       var that = this;
//       if(that.active_cell && that.active_cell !== ''){
//           that.close_div();
//           Jupyter.notebook.select_by_id(that.active_cell);
//           Jupyter.notebook.scroll_to_cell_id(that.active_cell);
//           return;
//       }
//       that.close_div();
//     };
//
//
    /** @method creates dependency div*/
    create_dep_div = function() {


        var that = this;


        this.depdiv = document.createElement('div');
        this.depdiv.setAttribute('class','dep-div container');
        $(this.parentdiv).append(this.depdiv);

        this.side_panel = d3.select('div.dep-div').append('div').attr('id','side-panel');

        this.tabular = this.side_panel.append("div").attr('id', 'table').classed('card', true);
        this.tabular.append('h3').text("Graph Overview").classed('card-header', true).classed('primary-color', true).classed('white-text', true).classed('cell-list-header', true).attr('id', 'overview-header');

        var newdiv = this.tabular.append('div').classed('table-div',true);
        newdiv.append('h4').text('New Cells').classed('card-header', true).classed('primary-color', true).classed('white-text', true).classed('cell-list-header', true);
        newdiv.append('div').classed('card-body', true).attr('id', 'newlist').append('ul').classed('list-group', true).classed('list-group-flush', true);

        var changediv = this.tabular.append('div').classed('table-div',true);
        changediv.append('h4').text('Changed Cells').classed('card-header', true).classed('primary-color', true).classed('white-text', true).classed('cell-list-header', true);
        changediv.append('div').classed('card-body', true).attr('id', 'changedlist').append('ul').classed('list-group', true).classed('list-group-flush', true);


        this.tabular.append('a').text('Download Dot').attr('id', 'dot-dl').classed('btnviz', true).classed('btnviz-primary', true).classed('fa', true)//.classed('btnviz', true).classed('btnviz-outline-primary', true).classed('btnviz-rounded waves-effect', true);

        this.tabular.append('a').text('Toggle Sink Cells').attr('id', 'out-toggle').classed('btnviz', true).classed('btnviz-primary', true).classed('fa', true)//.classed('btnviz', true).classed('btnviz-outline-primary', true).classed('btnviz-rounded waves-effect', true)
         .on('click',function () {
            that.dataflow = !that.dataflow;
            that.startGraphCreation();
        });

        //FIXME: This is where the Graph Summary button goes
        //this.tabular.append('a').text('Show Graph Summary').attr('id', 'graphsum').classed('btnviz', true).classed('btnviz-outline-primary', true).classed('btnviz-rounded waves-effect', true);


        this.executepanel = this.side_panel.append('div').attr('id', 'cell-detail').classed('card', true).style('background-color', 'white');
        this.executepanel.append('h3').text("Cell Overview").classed('card-header', true).classed('primary-color', true).classed('white-text', true).classed('cell-list-header', true).attr('id', 'overview-header');

        this.nodespanel = this.executepanel.append('div').attr('id', 'nodes-panel');
        this.nodespanel.append('h4').text("Cell Local Variables:").classed('card-title', true);
        this.nodespanel.data(["None"]).append('span').text('None').classed('badge-pill', true).classed('badge-danger', true);

        var executeactions = this.executepanel.append('div').attr('id','exec-actions');
        //FIME:FIX THIS
        // executeactions.append('a').text("  Execute Cell").classed('btnviz', true).classed('btnviz-primary', true).attr('id', 'exec-button').classed('fa-step-forward', true).classed('fa', true).on('click',function(){
        //     var cell = Jupyter.notebook.get_selected_cell();
        //     cell.execute();
        // });
        executeactions.append('a').text("Close and Go to Cell").attr('id', 'close-scroll').classed('btnviz', true).classed('btnviz-primary', true).classed('fa', true).on('click', function () {that.close_and_scroll();});

        this.svg = d3.select("div.dep-div").append('div').attr('id', 'svg-div').on('contextmenu', function () {
                return false;
            });
        this.is_created = true;
    };

        /** @method upon a new cell selection will change the details of the viewer **/
        set_details = function(cellid:string){
            var that = this;
            $('#'+that.active_cell+'cluster').find('polygon').toggleClass('selected',false);
            that.active_cell = cellid;
            d3.select('#select-identifier').remove();
            if(that.dfgraph.get_cells().indexOf(that.active_cell) > -1) {
                // @ts-ignore
                var rect_points = $('#' + that.active_cell + 'cluster').find('polygon').attr('points').split(' ');
                var rect_top = rect_points[1].split(',') as any;
                var height = Math.abs(rect_top[1]-Number(rect_points[0].split(',')[1]));
                d3.select('#svg-div svg g').insert('g', '#a_graph0 + *').attr('id', 'select-identifier').append('rect').attr('x', parseInt(rect_top[0])-3).attr('y', parseInt(rect_top[1])).attr('height', height).attr('width', '3px');
            }
            //FIXME: Find equivalent in Lab
            //console.log(NotebookTools);
            //Jupyter.notebook.select_by_id(that.active_cell);
            //Jupyter.notebook.scroll_to_cell_id(that.active_cell);
            $('#'+cellid+'cluster').find('polygon').toggleClass('selected',true);
            d3.select('#nodes-panel').selectAll('span').remove();
            var int_nodes = that.dfgraph.get_internal_nodes(cellid);
            if(int_nodes.length < 1){
                int_nodes = ['None'];
            }
            d3.select('#nodes-panel').selectAll('span')
                .data(int_nodes).enter().append('span').text(function(d:any){return d;}).attr('class',function (d:any) {
            var baseclasses = "badge badge-pill ";
                if(d === "None"){
                    return baseclasses + 'badge-danger';
                }
            return baseclasses + 'badge-primary';
            });
        };

        /** @method updates the new and changed cell lists **/
        update_cell_lists = function(){
            var that = this;
            let new_cells: string[] = [];
            var changed_cells: string[] = [];

            //Goes with code below
            //var cells = that.dfgraph.get_cells();

            //FIXME: Find Jupyter Equivalent
            // Jupyter.notebook.get_cells().map(function(cell){
            //     if(cell.cell_type === 'code'){
            //         if(cells.indexOf(cell.uuid) > -1){
            //             if(cell.metadata.cell_status.substr(0,'edited'.length) === 'edited'){
            //                 changed_cells.push(cell.uuid);
            //             }
            //         }
            //         else{
            //             new_cells.push(cell.uuid);
            //         }
            //     }
            // });


            var new_list = d3.select('#newlist').select('ul').selectAll('li').data(new_cells);

            new_list.attr('id',function(d){return 'viz-'+d;}).classed('cellid',true)
            .html(function(d){return 'In['+d+']';}).enter()
            .append('li').classed('list-group-item',true).append('a').classed('cellid',true).attr('id',function(d){return 'viz-'+d;})
            .html(function(d){return 'In['+d+']';});

            new_list.exit().attr('opacity',1).transition().delay(500).attr('opacity',0).remove();

            var changed_list = d3.select('#changedlist').select('ul').selectAll('li').data(changed_cells);

            changed_list.attr('id',function(d){return 'viz-'+d;}).classed('cellid',true)
            .html(function(d){return 'In['+d+']';}).enter()
            .append('li').classed('list-group-item',true).append('a').classed('cellid',true).attr('id',function(d){return 'viz-'+d;})
            .html(function(d){return 'In['+d+']';});

            changed_list.exit().attr('opacity',1).transition().delay(500).attr('opacity',0).remove();

            d3.select('#table').selectAll('.cellid').on('click',function (d) {
                that.set_details(d);
            });

            that.decorate_cells(changed_cells,'changed-cell',true);


        };


        decorate_cells = function(cells:any[],css_class:string,all_cells:any[]){

            cells = cells || [];
            all_cells = all_cells || false;

            if(all_cells) {
                $('.cluster').find('polygon').toggleClass(css_class, false);
            }

            cells.forEach(function (uuid) {
                $('#'+uuid+'cluster').find('polygon').toggleClass(css_class,true);
            });

        };

        decorate_cell = function(uuid:string,css_class:string,toggle:boolean){
            if(this.is_open) {
                uuid = uuid || '';
                $('#' + uuid + 'cluster').find('polygon').toggleClass(css_class, toggle);
            }
        };

        /** @method this creates and renders the actual visual graph **/
        create_graph = function(g:any){

            var that = this;
            g.nodes().forEach(function(v:any) {
                var node = g.node(v);
                // Round the corners of the nodes
                node.rx = node.ry = 5;
            });

            that.dotgraph = Writer.write(g);
            // var graphtran = d3.transition()
            // .duration(750)
            // .ease(d3.easeLinear);

            //FIXME: Not ideal way to be set this up, graphviz requires a set number of pixels for width and height
            graphviz('#svg-div').options(defaultOptions)
                .width(500)
                .height(500)
                .fit(true)
                .zoom(true)
                .on('end',function(){
                    that.update_cell_lists();
                    $('#svg-div').height('100vh');
                    $('#svg-div svg').height('100vh').width('100vw');
                    that.done_rendering = true;
                })
            .renderDot(that.dotgraph);
//                 FIXME: Add transition back in
//                .transition(graphtran)


            var dotURL = URL.createObjectURL(new Blob([that.dotgraph], {type: "text/plain;charset=utf-8"}));
            $('#dot-dl').attr("href",dotURL).attr("download", "graph.dot");

            $("g.parentnode.cluster").each(function () {
                $(this).mouseover(function(){
                var node = $(this),
                    cellid = node.find('text').text().substr(that.cell_label.length,uuid_length);

                that.set_details(cellid);

                //var cell = Jupyter.notebook.get_code_cell(cellid);
                that.dfgraph.get_downstreams(cellid).forEach(function (t:string) { $('#'+t.substr(0,uuid_length)+'cluster').find('polygon').toggleClass('upcell',true); $('g.'+cellid+t.substr(0,uuid_length)).find('path').toggleClass('upstream',true); });
                that.dfgraph.get_imm_upstreams(cellid).forEach(function (t:string) { $('#'+t.substr(0,uuid_length)+'cluster').find('polygon').toggleClass('downcell',true); $('g.'+t.substr(0,uuid_length)+cellid).find('path').toggleClass('downstream',true); });
            })
                .on("mouseout",function(){
                //var node = $(this);
                    //cellid = node.find('text').text().substr(that.cell_label.length,uuid_length);
                //var cell = Jupyter.notebook.get_code_cell(cellid);
                $('.edge').each(function(){
                    $(this).find('path').toggleClass('upstream',false).toggleClass('downstream',false);});
                $('g.parentnode, .cluster').each(function() {
                    $(this).find('polygon').toggleClass('upcell', false).toggleClass('downcell', false);
                }).contextmenu(function() {
                return false;
            });})});

            $("g.child-node").each(function () {
                $(this).mouseover(function(){
                    $('.viz-'+$(this).find('title').text()).each(function(){$(this).find('path').toggleClass('upstream',true);
                    $(this).find('polygon').toggleClass('upcell',true);});
                })
                    .mouseout(function () {
                    $('.viz-'+$(this).find('title').text()).each(function(){$(this).find('path').toggleClass('upstream',false)});
                    $(this).find('polygon').toggleClass('upcell',false);
                    })
                });

            //FIXME: Fix the Jupyter notebook reference here
            //var deleted_cells = Object.keys(Jupyter.notebook.metadata.hl_list || []);
            //that.decorate_cells(deleted_cells,'deleted-cell',true);

            $("g.parentnode.cluster")
                .on('mousedown',function(event) {
                    if(event.which == 1){
                            that.close_and_scroll();
                    }
                })
            //FIXME: Fix this
                // .on("contextmenu",function(event){
                //     var cellid = $(this).find('text').text().substr(that.cell_label.length, uuid_length);
                //     Jupyter.notebook.get_code_cell(cellid).execute();
                // });


        };

    /** @method this creates the graphlib data structure that is used to create the visualization **/
    create_node_relations = function(){
        var that = this;
        that.cell_links = [];
        that.cell_list = [];
        that.cell_child_nums = [];
        that.output_nodes = [];
        let outnames: string[] = [];

        if(that.dataflow){
            that.cell_list = that.dfgraph.get_cells();
            that.cell_list.forEach(function(uuid:string){
                that.output_nodes[uuid] = that.dfgraph.get_nodes(uuid);
                outnames = that.output_nodes[uuid];
                that.dfgraph.get_upstreams(uuid).forEach(function (b:string) {
                    if(outnames.indexOf(uuid) > -1){
                        that.cell_links.push({source: b, target: uuid});
                    }
                    else{
                        that.cell_links.push({source: b, target: (uuid + "-Cell")})
                    }
                });


            });
            //FIXME: Change this
            that.cell_list = that.cell_list.map(function (uuid:string) {
                return {'id':uuid};
            });
        }
        else{
            that.cell_list = that.dfgraph.get_cells();
            that.cell_list.forEach(function(uuid:string){

                that.output_nodes[uuid] = that.dfgraph.get_nodes(uuid);
                if(that.output_nodes[uuid].length == 0){
                    delete that.output_nodes[uuid];
                    return;
                }

                outnames = that.output_nodes[uuid];

                if(uuid in that.output_nodes) {
                    that.dfgraph.get_upstreams(uuid).forEach(function (b:string) {
                        if (outnames.indexOf(uuid) > -1) {
                            that.cell_links.push({source: b, target: uuid});
                        }
                        else {
                            outnames.forEach(function (t:string) {
                                that.cell_links.push({source: b, target: uuid + t});
                            });
                        }
                    });
                }

            });
            //FIXME: Change this
            that.cell_list = Object.keys(that.output_nodes).map(function (t:string) { return {'id':t} });
        }

        that.cell_list.forEach(function(a:any) {that.cell_child_nums[a.id] = 0;});
        that.cell_links.forEach(function(a:any){ that.cell_child_nums[a.source] += 1;});
        var g = new GraphLib.Graph({compound:true}).setGraph({ranksep:2,nodesep:.1,tooltip:' ',rankdir:'LR'}).setDefaultEdgeLabel(function () {
            return {};
        });



        that.cell_list.forEach(function(a:any){
            if(that.output_nodes[a.id]){
                if(that.selected && a.level == 0){ g.setNode("cluster_Out["+a.id+"]", {label: that.cell_label + a.id, id:'selected', clusterLabelPos:'top', class:'parentnode cellid',shape:'box'});}
                else{g.setNode("cluster_Out["+a.id+"]", {label: that.cell_label + a.id,id:a.id+'cluster', clusterLabelPos:'top', class:'parentnode cellid',tooltip:' ',shape:'box'});}
            }
        });

        Object.keys(that.output_nodes).forEach(function (a:any) {
            var parent = 'cluster_Out['+a+']';
            if(that.dataflow || that.selected){
                var cell = a+'-Cell';
                g.setNode(cell,{label:'Cell['+a+']',class:'child-node prompt output_prompt cellid', labelStyle:that.labelstyles, style:'invis',peripheries:0, height:0, width:0,tooltip:' ',shape:'box',id:cell});
                g.setParent(cell,parent);

            }
            that.output_nodes[a].forEach(function (t:string) {
                //var uuid = t.substr(4,uuid_length);
                //FIXME: Make this more robust so it uses uuid_length
                if(/cluster_Out\_[a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9]/.test(t)){
                    g.setNode(a+t,{label:parent, class:'child-node prompt output_prompt cellid', labelStyle:that.labelstyles,tooltip:' ',shape:'box',id:a+t}); g.setParent(a+t,parent);
                }
                else{
                    g.setNode(a+t,{label:t, class:'child-node prompt output_prompt cellid', labelStyle:that.labelstyles,tooltip:' ',shape:'box',id:a+t}); g.setParent(a+t,parent);
                }

        }) });

        that.cell_links.forEach(function (a:any) {
            if(g.hasNode(a.source) && g.hasNode(a.target)) {
                g.setEdge(a.source, a.target, {
                    class: a.source.substr(0, uuid_length) + a.target.substr(0, uuid_length) + ' viz-'+a.source,
                    id: 'viz-'+a.source + a.target,
                    lhead: 'cluster_Out[' + a.target.substr(0, uuid_length) + ']'
                });
            }
        });

        if(that.debug_mode) {
            console.log(that.cell_list);
            console.log(that.output_nodes);
            console.log(that.cell_links);
            console.log(g.children());
            console.log(g.nodes());
            console.log(g.edges());
            console.log(Writer.write(g));
        }

        return g;
    };

    /** @method this opens and closes the depviewer **/
    toggle_dep_view = function() {

        var that = this;
        if(this.is_open){
            that.close_div();
        }
        else {
            that.is_open = true;

            //that.active_cell = Jupyter.notebook.get_selected_cell().uuid;

            //FIXME: Doesn't currently exist in this version
            //var deleted_cells = Object.keys(Jupyter.notebook.metadata.hl_list || []);
            //that.decorate_cells(deleted_cells,'deleted-cell',true);

            //FIXME: Possibly change this?
            //GraphViz relies on the size of the svg to make the initial adjustments so the svg has to be sized first
            d3.select(that.parentdiv).transition().delay(100).style('height','60vh').on('end',function () {
                if(that.dfgraph.was_changed){
                    that.done_rendering = false;
                    that.startGraphCreation();
                }
            });

            d3.select('.end_space').transition().delay(100).style('height','60vh');
            that.depdiv.style.display = 'block';

        }
    };

    /** @method starts graph creation **/
    startGraphCreation = function(){
        var that = this;
        var g = this.create_node_relations();
                this.create_graph(g);
                that.dfgraph.was_changed = false;
    };

    /** @method set graph, sets the current activate graph to be visualized */
    set_graph = function(graph:any){
        this.dfgraph = graph;
    }
//
//
 }