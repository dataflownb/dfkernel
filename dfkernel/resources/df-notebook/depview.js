// Copyright (c) Dataflow Notebook Development Team.
// Distributed under the terms of the BSD-3 License.
/**
 *
 *
 * @module depview
 * @namespace depview
 * @class DepView
 */

define(["require",
        "jquery",
        "lodash",
        "graphlib",
        "graphdotwriter",
        "base/js/namespace",
        'd3',
        'viz',
        'd3graphviz',
        'jquery-ui',
    ],
    function(require,$, _, GraphLib, Writer, Jupyter, d3, Viz) {
    "use strict";

    var DepView = function (dfgraph,parentdiv,labelstyles) {
        /**
         * Constructor
         *
         * The DepView which contains all the information required for Visualization
         *
         * Parameters
         *  dfgraph: an instance of the DfGraph class that the Depviewer can call
         *  parentdiv: if not set will default to lower-header-bar in the header
         *  labelstyles: a group of labelstyles that will be applied directly to the all text in the graph
         *
         */

        //Flags
        this.is_open = false;
        this.dataflow = true;
        this.selected = false;
        this.done_rendering = false;

        //Turn on console logs
        this.debug_mode = false;

        //Divs and Div related variables
        this.parentdiv = parentdiv || 'div.lower-header-bar';
        this.depdiv = null;
        this.side_panel = null;
        this.nodespanel = null;
        this.svg = null;
        this.tabular = null;
        this.execute_panel = null;

        //Label Styles should be set in text so that GraphViz can properly size the nodes
        this.labelstyles = labelstyles || 'font-family: monospace; fill: #D84315; font-size: 1.3em;';

        //Divs are created and defined in here
        this.create_dep_div();

        //This has been largely factored out but this provides the option to change the label of a cell
        this.cell_label = "";

        this.cell_links = [];
        this.cell_list = [];
        this.cell_child_nums = [];
        this.output_nodes = [];
        this.active_cell = '';

        this.dfgraph = dfgraph;


        this.dotgraph = [];

        this.bind_events();

    };


    DepView.prototype = Object.create(DepView.prototype);

    /** @method bind_events */
    DepView.prototype.bind_events = function () {
        var that = this;
        var nb = Jupyter.notebook;

        nb.events.on('create.Cell', function() {
            //FIXME: This triggers on undelete update cell styles in here too
            if(that.is_open){
                that.update_cell_lists();
            }
        });
        nb.events.on('select.Cell', function(){
            var cell = Jupyter.notebook.get_selected_cell();
           if(cell.cell_type === 'code'){
               that.set_details(cell.uuid);
           }
        });
        nb.events.on('delete.Cell',function () {
           //FIXME: Update cell styles in here to ensure proper cells show deleted status
            if(that.is_open){
                console.log('Cell Deleted');
            }
        });
    };

    /** @method closes the depviewer **/
    DepView.prototype.close_div = function(){
        this.is_open = false;
        this.depdiv.style.display = "none";
            d3.select(this.parentdiv).transition().delay(100).style('height','0vh');
            d3.select('.end_space').transition().delay(100).style('height','0vh');
    };

    /** @method closes the depviewer and scrolls to the currently selected cell **/
    DepView.prototype.close_and_scroll = function () {
      var that = this;
      if(that.active_cell && that.active_cell !== ''){
          that.close_div();
          Jupyter.notebook.select_by_id(that.active_cell);
          Jupyter.notebook.scroll_to_cell_id(that.active_cell);
          return;
      }
      that.close_div();
    };


    /** @method creates dependency div*/
    DepView.prototype.create_dep_div = function() {


        var that = this;

        var cssfiles = ['depview','mdb'];

        cssfiles.forEach(function (file) {
            var link = document.createElement("link");
            link.type = "text/css";
            link.rel = "stylesheet";
            link.href = require.toUrl('./css/'+file+'.css', 'css');
            document.getElementsByTagName("head")[0].appendChild(link);
        });


        this.depdiv = document.createElement('div');
        this.depdiv.setAttribute('class','dep-div container');
        this.depdiv.style.display = "none";
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
        executeactions.append('a').text("  Execute Cell").classed('btnviz', true).classed('btnviz-primary', true).attr('id', 'exec-button').classed('fa-step-forward', true).classed('fa', true).on('click',function(){
            var cell = Jupyter.notebook.get_selected_cell();
            cell.execute();
        });
        executeactions.append('a').text("Close and Go to Cell").attr('id', 'close-scroll').classed('btnviz', true).classed('btnviz-primary', true).classed('fa', true).on('click', function () {that.close_and_scroll();});

        this.svg = d3.select("div.dep-div").append('div').attr('id', 'svg-div').append("svg")
            .attr("id", "svg").on('contextmenu', function () {
                return false;
            });
    };

        /** @method upon a new cell selection will change the details of the viewer **/
        DepView.prototype.set_details = function(cellid){
            var that = this;
            $('#'+that.active_cell+'cluster').find('polygon').toggleClass('selected',false);
            that.active_cell = cellid;
            d3.select('#select-identifier').remove();
            if(that.dfgraph.get_cells().indexOf(that.active_cell) > -1) {
                var rect_points = $('#' + that.active_cell + 'cluster').find('polygon').attr('points').split(' ');
                var rect_top = rect_points[1].split(',');
                var height = Math.abs(rect_top[1]-rect_points[0].split(',')[1]);
                d3.select('#svg svg g').insert('g', '#a_graph0 + *').attr('id', 'select-identifier').append('rect').attr('x', parseInt(rect_top[0])-3).attr('y', parseInt(rect_top[1])).attr('height', height).attr('width', '3px');
            }
            Jupyter.notebook.select_by_id(that.active_cell);
            Jupyter.notebook.scroll_to_cell_id(that.active_cell);
            $('#'+cellid+'cluster').find('polygon').toggleClass('selected',true);
            d3.select('#nodes-panel').selectAll('span').remove();
            var int_nodes = that.dfgraph.get_internal_nodes(cellid);
            if(int_nodes.length < 1){
                int_nodes = ['None'];
            }
            d3.select('#nodes-panel').selectAll('span')
                .data(int_nodes).enter().append('span').text(function(d){return d;}).attr('class',function (d) {
            var baseclasses = "badge badge-pill ";
                if(d === "None"){
                    return baseclasses + 'badge-danger';
                }
            return baseclasses + 'badge-primary';
            });
        };

        /** @method updates the new and changed cell lists **/
        DepView.prototype.update_cell_lists = function(){
            var that = this;
            var new_cells = [];
            var changed_cells = [];
            var cells = that.dfgraph.get_cells();

            Jupyter.notebook.get_cells().map(function(cell){
                if(cell.cell_type === 'code'){
                    if(cells.indexOf(cell.uuid) > -1){
                        //FIXME: Change this to whatever identifier we use to detect if cell was changed
                        if(cell.was_changed){
                            changed_cells.push(cell.uuid);
                        }
                    }
                    else{
                        new_cells.push(cell.uuid);
                    }
                }
            });

            console.log(new_cells);
            console.log(changed_cells);



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
        };

        /** @method this creates and renders the actual visual graph **/
        DepView.prototype.create_graph = function(g){

            var that = this;
            g.nodes().forEach(function(v) {
                var node = g.node(v);
                // Round the corners of the nodes
                node.rx = node.ry = 5;
            });

            that.dotgraph = Writer.write(g);

            var graphtran = d3.transition()
            .duration(750)
            .ease(d3.easeLinear);

            //FIXME: Not ideal way to be set this up, graphviz requires a set number of pixels for width and height
            d3.select('#svg')
            .graphviz()
                .width($('svg').width())
                .height($('svg').height())
                .fit(true)
                .zoom(true)
                .on('end',function(){
                    that.update_cell_lists();
                    that.done_rendering = true;
                })
                .transition(graphtran)
            .renderDot(that.dotgraph);

            var dotURL = URL.createObjectURL(new Blob([that.dotgraph], {type: "text/plain;charset=utf-8"}));
            $('#dot-dl').attr("href",dotURL).attr("download", "graph.dot");

            $("g.parentnode.cluster").each(function () {
                $(this).mouseover(function(){
                var node = $(this),
                    cellid = node.find('text').text().substr(that.cell_label.length,6);

                that.set_details(cellid);

                var cell = Jupyter.notebook.get_code_cell(cellid);
                that.dfgraph.get_downstreams(cellid).forEach(function (t) { $('#'+t.substr(0,6)+'cluster').find('polygon').toggleClass('upcell',true); $('g.'+cellid+t.substr(0,6)).find('path').toggleClass('upstream',true); });
                that.dfgraph.get_imm_upstreams(cellid).forEach(function (t) { $('#'+t.substr(0,6)+'cluster').find('polygon').toggleClass('downcell',true); $('g.'+t.substr(0,6)+cellid).find('path').toggleClass('downstream',true); });
            })
                .on("mouseout",function(){
                var node = $(this),
                    cellid = node.find('text').text().substr(that.cell_label.length,6);
                var cell = Jupyter.notebook.get_code_cell(cellid);
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


            $("g.parentnode.cluster")
                .each(function(t){
                    var cellid = $(this).find('text').text().substr(that.cell_label.length, 6);
                    if(Jupyter.notebook.get_code_cell(cellid).was_changed){
                        $(this).toggleClass('was-changed',true).select('polygon').toggleClass('was-changed-poly',true);
                    }
                })
                .on('mousedown',function(event) {
                    if(event.which == 1){
                            close_and_scroll();
                    }
                })
                .on("contextmenu",function(event){
                    var cellid = $(this).find('text').text().substr(that.cell_label.length, 6);
                    Jupyter.notebook.get_code_cell(cellid).execute();
                });


        };

    /** @method this creates the graphlib data structure that is used to create the visualization **/
    DepView.prototype.create_node_relations = function(){
        var that = this;
        that.cell_links = [];
        that.cell_list = [];
        that.cell_child_nums = [];
        that.output_nodes = [];
        var outnames = [];

        if(that.dataflow){
            that.cell_list = that.dfgraph.get_cells();
            that.cell_list.forEach(function(uuid){
                that.output_nodes[uuid] = that.dfgraph.get_nodes(uuid);
                outnames = that.output_nodes[uuid];
                that.dfgraph.get_upstreams(uuid).forEach(function (b) {
                    if(outnames.indexOf(uuid) > -1){
                        that.cell_links.push({source: b, target: uuid});
                    }
                    else{
                        that.cell_links.push({source: b, target: (uuid + "-Cell")})
                    }
                });


            });
            //FIXME: Change this
            that.cell_list = that.cell_list.map(function (uuid) {
                return {'id':uuid};
            });
        }
        else{
            that.cell_list = that.dfgraph.get_cells();
            that.cell_list.forEach(function(uuid){

                that.output_nodes[uuid] = that.dfgraph.get_nodes(uuid);
                if(that.output_nodes[uuid].length == 0){
                    delete that.output_nodes[uuid];
                    return;
                }

                outnames = that.output_nodes[uuid];

                if(uuid in that.output_nodes) {
                    that.dfgraph.get_upstreams(uuid).forEach(function (b) {
                        if (outnames.indexOf(uuid) > -1) {
                            that.cell_links.push({source: b, target: uuid});
                        }
                        else {
                            outnames.forEach(function (t) {
                                that.cell_links.push({source: b, target: uuid + t});
                            });
                        }
                    });
                }

            });
            //FIXME: Change this
            that.cell_list = Object.keys(that.output_nodes).map(function (t) { return {'id':t} });
        }

        that.cell_list.forEach(function(a) {that.cell_child_nums[a.id] = 0;});
        that.cell_links.forEach(function(a){ that.cell_child_nums[a.source] += 1;});
        var g = new GraphLib.Graph({compound:true}).setGraph({ranksep:2,nodesep:.1,tooltip:' ',rankdir:'LR'}).setDefaultEdgeLabel(function () {
            return {};
        });



        that.cell_list.forEach(function(a){
            if(that.output_nodes[a.id]){
                if(that.selected && a.level == 0){ g.setNode("Out["+a.id+"]", {label: that.cell_label + a.id, id:'selected', clusterLabelPos:'top', class:'parentnode cellid',shape:'box'});}
                else{g.setNode("Out["+a.id+"]", {label: that.cell_label + a.id,id:a.id+'cluster', clusterLabelPos:'top', class:'parentnode cellid',tooltip:' ',shape:'box'});}
            }
        });

        Object.keys(that.output_nodes).forEach(function (a) {
            var parent = 'Out['+a+']';
            if(that.dataflow || that.selected){
                var cell = a+'-Cell';
                g.setNode(cell,{label:'Cell['+a+']',class:'child-node prompt output_prompt cellid', labelStyle:that.labelstyles, style:'invis',peripheries:0, height:0, width:0,tooltip:' ',shape:'box',id:cell});
                g.setParent(cell,parent);

            }
            that.output_nodes[a].forEach(function (t) {
                var uuid = t.substr(4,6);
                if(/Out\_[a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9]/.test(t)){
                    g.setNode(a+t,{label:parent, class:'child-node prompt output_prompt cellid', labelStyle:that.labelstyles,tooltip:' ',shape:'box',id:a+t}); g.setParent(a+t,parent);
                }
                else{
                    g.setNode(a+t,{label:t, class:'child-node prompt output_prompt cellid', labelStyle:that.labelstyles,tooltip:' ',shape:'box',id:a+t}); g.setParent(a+t,parent);
                }

        }) });

        that.cell_links.forEach(function (a) {
            if(g.hasNode(a.source) && g.hasNode(a.target)) {
                g.setEdge(a.source, a.target, {
                    class: a.source.substr(0, 6) + a.target.substr(0, 6) + ' viz-'+a.source,
                    id: 'viz-'+a.source + a.target,
                    lhead: 'clusterOut[' + a.target.substr(0, 6) + ']'
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
    DepView.prototype.toggle_dep_view = function() {

        var that = this;
        if(this.is_open){
            that.close_div();
        }
        else {
            that.is_open = true;

            that.active_cell = '';

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

    DepView.prototype.startGraphCreation = function(){
        var that = this;
        var g = this.create_node_relations();
                this.create_graph(g);
                that.dfgraph.was_changed = false;
    };

     return {
        'DepView': DepView
    };
});
