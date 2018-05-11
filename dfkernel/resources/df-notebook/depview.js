define(["jquery",
    "base/js/namespace",
    '/kernelspecs/dfpython3/df-notebook/d3.v4.min.js',
    '/kernelspecs/dfpython3/df-notebook/dagre-d3.min.js',
    '/kernelspecs/dfpython3/df-notebook/jquery-ui.js',
    ],
    function($, Jupyter, d3, dagreD3) {
    "use strict";
        var max_level,min_level = 0;
        var cell_links = [],
            cell_list = [],
            cell_child_nums = [],
            output_nodes = [],
            internal_nodes = [];
        var globaldf = false;
        var globalselect = false;


        var margin = {top:20, right:120, bottom:20, left: 120},
            width = $(window).width() - margin.right - margin.left,
            height = $(window).height() - margin.top - margin.bottom;

        var close_div = function(){
            var dep_div = $('.dep-div')[0];
                dep_div.style.width = "0%";
                dep_div.zIndex = '-999';
                $('.control-div').remove();
                d3.select('#source-code').remove();
                d3.selectAll("div.tooltipsy").remove();
                d3.select("div.dep-div svg").transition().delay(1000).remove();
        };


        var create_dep_div = function() {
            var link = document.createElement("link");
            link.type = "text/css";
            link.rel = "stylesheet";
            link.href = require.toUrl('/kernelspecs/dfpython3/df-notebook/depview.css','css');
            document.getElementsByTagName("head")[0].appendChild(link);

            var closebtn = document.createElement('a');
            closebtn.setAttribute("class","closebutton");
            closebtn.setAttribute("href","#");
            closebtn.innerHTML = "&times;";
            var depdiv = document.createElement('div');
            depdiv.setAttribute('class','dep-div');
            //This is a very "goofy" way to have to do this, this seems to be evaluated if you make onclick = close_div()
            closebtn.onclick = function() { close_div()};
            depdiv.append(closebtn);
            $('body').append(depdiv);
            return depdiv;
        };

        var attach_controls = function(depdiv){
            var control_div = document.createElement("div");
            control_div.className = 'control-div';

            var slider = document.createElement("div");
            slider.setAttribute('id','slider-range');

            var p_ele = document.createElement('p');
            p_ele.setAttribute('id','up-down');
            var text_updown = document.createTextNode("Levels Down: " + Math.abs(min_level) + "   Levels Up: " + Math.abs(max_level));
            p_ele.appendChild(text_updown);

            control_div.appendChild(p_ele);
            control_div.appendChild(slider);

            depdiv.appendChild(control_div);
            $( "#slider-range" ).slider({
              range: true,
              min: min_level,
              max: max_level,
              values: [ min_level, max_level ],
              slide: function( event, ui ) {
                $( "#up-down" ).text("Levels Down: " + Math.abs(ui.values[ 0 ]) + "   Levels Up: " + Math.abs(ui.values[ 1 ]));
                recreate_graph(ui.values[1],ui.values[0]);
              }
            });
        };

        var create_graph = function(svg, g,inner){

            g.nodes().forEach(function(v) {
                var node = g.node(v);
                // Round the corners of the nodes
                node.rx = node.ry = 5;
            });

            var zoom = d3.zoom()
            .on("zoom", function() {
            inner.attr("transform", d3.event.transform);
            });
            svg.call(zoom);

            var render = new dagreD3.render();

            g.graph().transition = function(selection) {
                return selection.transition().duration(500);
            };

            d3.select("svg g").call(render, g);

            var initialScale = 0.75;
            svg.call(zoom.transform, d3.zoomIdentity.translate((svg.attr("width") - g.graph().width * initialScale) / 2, 20).scale(initialScale));

            svg.selectAll('#internal').classed('cluster',false).classed('internal',true);
            // zoom
            //     .translate([(svg.attr("width") - g.graph().width * initialScale) / 2, 20])
            //     .scale(initialScale)
            //     .event(svg);
            svg.attr('height', $(window).height() * .7);

            svg.selectAll("g.parentnode, .cluster")
                .on("mouseover",function(){
                var node = d3.select(this),
                    cellid = node.select('tspan').text().substr("Cell ID: ".length,6);
                d3.select('#source-code').select('p').text("In ["+cellid+"]");

                d3.select('#source-code').select('pre').text(Jupyter.notebook.get_code_cell(cellid).get_text());

                var cell = Jupyter.notebook.get_code_cell(cellid);
                cell.cell_imm_downstream_deps.forEach(function (t) { d3.select('#'+t.substr(0,6)+'cluster').select('rect').style('stroke','red'); svg.selectAll('g.'+cellid+t.substr(0,6)).select('path').style('stroke-width','4px').style('stroke','red'); });
                cell.cell_imm_upstream_deps.forEach(function (t) { d3.select('#'+t.substr(0,6)+'cluster').select('rect').style('stroke','blue'); svg.selectAll('g.'+t.substr(0,6)+cellid).select('path').style('stroke-width','4px').style('stroke','blue'); });
                d3.select(this).select("rect").style({"stroke":"green"});
            }).on("mouseout",function(){
                var node = d3.select(this),
                    cellid = node.select('tspan').text().substr("Cell ID: ".length,6);
                var cell = Jupyter.notebook.get_code_cell(cellid);
                svg.selectAll('.edgePath').select('path').style('stroke-width','1.5px').style('stroke','black');
                svg.selectAll('g.parentnode, .cluster').select('rect').style('stroke-width','1.5px').style('stroke','#999');
            }).on("contextmenu",function() {
                return false;
            });


            $("g.parentnode, .cluster").css('fill',function(t){
                var cellid = d3.select(this).select('tspan').text().substr("Cell ID: ".length, 6);
                if(Jupyter.notebook.get_code_cell(cellid).was_changed){ d3.select(this).style('stroke-dasharray', '10,10').style('stroke-width','4px'); return "red";}
                return;
            }).on('mousedown',function(event) {
                console.log(event.which);
                if(event.ctrlKey && event.which == 1){
                                    var node = d3.select(this),
                    cellid = node.select('tspan').text().substr("Cell ID: ".length, 6);
                var visited = [];
                var down = Jupyter.notebook.get_code_cell(cellid).cell_imm_downstream_deps;
                while (down.length > 0) {
                    var child = down.pop();
                    visited.push(child);
                    Jupyter.notebook.get_code_cell(cellid.substr(0, 6)).cell_imm_downstream_deps.forEach(function (t) {
                        var subbed = t.substr(0, 6);
                        if (!(visited.includes(subbed)) && !(down.includes(subbed))) {
                            down.push(subbed);
                        }
                    })
                }
                visited.forEach(function (t) {
                    g.removeNode(t);
                });
                d3.select("svg g").call(render, g);
                }
                else if(event.which == 1){
                    close_div();
                    var node = d3.select(this),
                        cellid = node.select('tspan').text().substr(9,6);
                    Jupyter.notebook.select_by_id(cellid);
                    Jupyter.notebook.scroll_to_cell_id(cellid);
                }
                else if(event.which == 3 && !globalselect){
                    var node = d3.select(this),
                    cellid = node.select('tspan').text().substr("Cell ID: ".length, 6);
                    Jupyter.notebook.get_code_cell(cellid).execute();
                    Jupyter.notebook.get_code_cell(cellid).was_changed = false;
                    node.style('fill','yellow');
                    setTimeout(function (){
                        var newg = create_node_relations(globaldf,globalselect);
                        newg.graph().transition = function(selection) {
                return selection.transition().duration(500);
            };
                        create_graph(svg,newg,inner);
                    }, 2000);


                }
            }).on("contextmenu",function(event){return false;});


            d3.selectAll("g.node.childnode").select('rect').on('mouseover',function (inner) {
                cell_links.forEach(function (links) {
                    if(links.source == inner){
                        svg.selectAll('g#'+inner+links.target).select('path').style('stroke-width','4px').style('stroke','red');
                    }
                    if(links.target == inner) {
                        svg.selectAll('g#'+links.source+inner).select('path').style('stroke-width','4px').style('stroke','blue');
                    }
                });
            }).on('mouseout',function(inner){
                svg.selectAll('.edgePath').select('path').style('stroke-width','1.5px').style('stroke','black');
            });

            //FIXME: This may be revisted, Clusterlabels get occluded by the arrows
            d3.selectAll('.cluster').selectAll('tspan').style('stroke','none').style('fill','blue').style('font-family','monospace').style('font-size','1em').style('font-weight','normal').style('fill-opacity',0);

        };

        var recreate_graph = function(up,down){


            var svg = d3.select('#svg');

            var margin = {top:30, right:120, bottom:20, left: 120},
            width = svg.width,
            height = svg.height;

            var inner =  svg.select('g');

            var g = new dagreD3.graphlib.Graph({compound:true}).setGraph({}).setDefaultEdgeLabel(function () {
                return {};
            });

            var updated_cell_list = cell_list.filter(function(a){
                return a.level <= up && a.level >= down;
            }).map(function(a){ return a.id;});

            updated_cell_list.forEach(function(a){
                if(output_nodes[a]){g.setNode("Out["+a+"]", {label: "Cell ID: " + a + '\nOutputs:' + [].concat.apply(output_nodes[a] || "None"), text:"Test", class:'parentnode'});}
            });

            var updated_internal_nodes = Object.keys(internal_nodes).filter(function(a){
                return updated_cell_list.includes(a);
            })

            var updated_out_nodes = Object.keys(output_nodes).filter(function(a){
               return updated_cell_list.includes(a);
            });

            updated_internal_nodes.forEach(function (a) {
            if(internal_nodes[a].length){
            var parent = 'Out['+a+']';
            var internal = parent + 'internal';
            g.setNode(internal,{label:'Internal Nodes', id:'internal',clusterLabelPos:'top',labelStyle:'font-family:monospace;font-size:1.3em'});
            g.setParent(internal,parent);
                internal_nodes[a].forEach(function (t) {
                    g.setNode(internal+t,{label:t, class:'internalnode childnode', labelStyle:'font-family:monospace;fill:#303F9F;font-size:1.3em;'}); g.setParent(internal+t,internal);
            })
            }
        });

            var labelstyles = 'font-family: monospace; fill: #D84315; font-size: 1.3em;';
            updated_out_nodes.forEach(function (a) {
                var parent = 'Out['+a+']';
                var cell = a+'-Cell';
                g.setNode(cell,{label:'Cell['+a+']',class:'childnode',labelStyle:labelstyles});
                g.setParent(cell,parent);
                updated_cell_list.push(a+'-Cell');
                output_nodes[a].forEach(function (t) {
                    var uuid = t.substr(4,6);
                    if(/Out\[[a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9]\]/.test(t)){
                        updated_cell_list.push(uuid);
                        g.setNode(uuid,{label:parent, class:'childnode',labelStyle:labelstyles}); g.setParent(uuid,parent);
                    }
                    else{
                        updated_cell_list.push(a+t);
                        g.setNode(a+t,{label:t, class:'childnode',labelStyle:labelstyles}); g.setParent(a+t,parent);
                    }
            }) });

            cell_links.forEach(function (a) {
                if(updated_cell_list.includes(a.source) && updated_cell_list.includes(a.target)) {
                    g.setEdge(a.source, a.target,{class:a.source.substr(0,6)+a.target.substr(0,6)});
                }
            });


            create_graph(svg,g,inner);

        };

        var create_node_relations = function(dataflow,selected){
            cell_links = [];
        cell_list = [];
        cell_child_nums = [];
        output_nodes = [];
        internal_nodes = [];

            if(dataflow){
        Jupyter.notebook.get_cells().forEach(function(a) {
            if (a.cell_type == 'code') {
                var outnames = [];
                output_nodes[a.uuid] = [];
                if((a.output_area.outputs).length >= 1) {
                    output_nodes[a.uuid] = a.output_area.outputs.reduce(function (c, d) {
                        if(d.output_type != 'error' && d.output_type != 'stream'){
                            outnames.push(d.metadata.output_tag || a.uuid);
                            return c.concat(d.metadata.output_tag || "Out[" + a.uuid + "]");}
                        return c;
                    }, []);
                }

                internal_nodes[a.uuid] = a.internal_nodes.filter(function(x) { return output_nodes[a.uuid].indexOf(x) < 0});

                cell_list.push({id: a.uuid});
                a.cell_imm_upstream_deps.forEach(function (b) {
                    if(outnames.includes(a.uuid)){
                        cell_links.push({source: b, target: a.uuid});
                    }
                    else{
                        cell_links.push({source: b, target: (a.uuid + "-Cell")})
                    }
                });
            }
        });}
        else if(selected){
            max_level = 0;
            min_level = 0;
            var selected_cell = Jupyter.notebook.get_selected_cell();
            var upstreams = selected_cell.cell_imm_upstream_deps.concat(selected_cell.uuid).reduce(function(a,b){
                if(!(b.substr(0,6) in a)){ return a.concat(b.substr(0,6));}
            },[]);
            var nextset = [];
            var downstreams = selected_cell.cell_imm_downstream_deps;
            var cells_list = new Set(upstreams.concat(downstreams));
            var levels = 1;
            var copied = upstreams.slice(0);
            while(upstreams.length > 0){
                var up = upstreams.pop();
                var cell = Jupyter.notebook.get_code_cell(up.substr(0,6));
                var outnames = [];
                cell_list.push({id: cell.uuid,level:levels});
                nextset = nextset.concat(cell.cell_imm_upstream_deps);
                output_nodes[cell.uuid] = [];
                if((cell.output_area.outputs).length >= 1) {
                    output_nodes[cell.uuid] = cell.output_area.outputs.reduce(function (c, d) {
                        if(d.output_type != 'error' && d.output_type != 'stream'){
                            outnames.push(d.metadata.output_tag || cell.uuid);
                            return c.concat(d.metadata.output_tag || "Out[" + cell.uuid + "]");}
                        return c;
                    }, []);
                internal_nodes[cell.uuid] = cell.internal_nodes.filter(function(x) { return output_nodes[cell.uuid].indexOf(x) < 0});
                }

                cell.cell_imm_upstream_deps.forEach(function (b) {
                    if(outnames.includes(cell.uuid)){
                        cell_links.push({source: b, target: cell.uuid});
                    }
                    else{
                        cell_links.push({source: b, target: (cell.uuid + "-Cell")})
                    }
                });
                if(!(upstreams.length)){
                    if(nextset.length){
                        levels += 1;
                        nextset = nextset.reduce(function(a,b){
                var bstripped = b.substr(0,6);
                if(!(a.includes(bstripped)) && !(cells_list.has(bstripped))){
                    cells_list.add(bstripped);
                    return a.concat(bstripped);
                }
                return a;
            },[]);
                        upstreams = nextset;
                        nextset = [];
                    }
                }
            }
            nextset = [];
            max_level = levels;
            levels = -1;
            copied = downstreams.slice(0);
            while(downstreams.length > 0){
                var down = downstreams.pop();
                var cell = Jupyter.notebook.get_code_cell(down);
                var outnames = [];
                cell_list.push({id: cell.uuid,level:levels});
                output_nodes[cell.uuid] = [];
                nextset = nextset.concat(cell.cell_imm_downstream_deps);
                if((cell.output_area.outputs).length >= 1) {
                    output_nodes[cell.uuid] = cell.output_area.outputs.reduce(function (c, d) {
                        if(d.output_type != 'error' && d.output_type != 'stream'){
                            outnames.push(d.metadata.output_tag || cell.uuid);
                            return c.concat(d.metadata.output_tag || "Out[" + cell.uuid + "]");}
                        return c;
                    }, []);
                    internal_nodes[cell.uuid] = cell.internal_nodes.filter(function(x) { return output_nodes[cell.uuid].indexOf(x) < 0});
                }
                cell.cell_imm_upstream_deps.forEach(function (b) {
                    if(cells_list.has(b.substr(0,6))) {
                        if (outnames.includes(cell.uuid)) {
                            cell_links.push({source: b, target: cell.uuid});
                        }
                        else {
                            cell_links.push({source: b, target: (cell.uuid + "-Cell")})
                        }
                    }
                });
                if(!(downstreams.length)){
                    if(nextset.length){
                        levels -= 1;
                        nextset = nextset.reduce(function(a,b){
                var bstripped = b.substr(0,6);
                if(!(a.includes(bstripped)) && !(cells_list.has(bstripped))){
                    cells_list.add(bstripped);
                    return a.concat(bstripped);
                }
                return a;
            },[]);
                        upstreams = nextset;
                        nextset = [];
                    }
                }
            }
            cell_list[0] = {id:selected_cell.uuid,level:0};
            min_level = cell_list.reduce(function(prev,curr){
                return prev < curr.level ? prev : curr.level;
            },0);
            max_level = cell_list.reduce(function(prev,curr){
                return prev > curr.level ? prev : curr.level;
            },0);
            console.log(cell_list);
        }
        else{
        Jupyter.notebook.get_cells().forEach(function(a) {
            if (a.cell_type == 'code') {
                var outnames = [];
                if((a.output_area.outputs).length >= 1) {
                    output_nodes[a.uuid] = a.output_area.outputs.reduce(function (c, d) {
                        if(d.output_type != 'error' && d.output_type != 'stream'){
                            outnames.push(d.metadata.output_tag || a.uuid);
                            return c.concat(d.metadata.output_tag || "Out[" + a.uuid + "]");}
                        return c;
                    }, []);
                    internal_nodes[a.uuid] = a.internal_nodes.filter(function(x) { return output_nodes[a.uuid].indexOf(x) < 0});
                    if(output_nodes[a.uuid].length == 0){
                        delete output_nodes[a.uuid];
                    }
                    cell_list.push({id: a.uuid});
                    a.cell_imm_upstream_deps.forEach(function (b) {
                        if(outnames.includes(a.uuid)){
                            cell_links.push({source: b, target: a.uuid});
                        }
                        else{
                            outnames.forEach(function (t) { cell_links.push({source: b, target: a.uuid+t}); });
                        }
                });
                }


            }

        });
        }
        cell_list.forEach(function(a) {cell_child_nums[a.id] = 0;});
        cell_links.forEach(function(a){ cell_child_nums[a.source] += 1;});
        var g = new dagreD3.graphlib.Graph({compound:true}).setGraph({}).setDefaultEdgeLabel(function () {
            return {};
        });



        cell_list.forEach(function(a){
            if(output_nodes[a.id]){
                if(selected && a.level == 0){ g.setNode("Out["+a.id+"]", {label: "Cell ID: " + a.id, id:'selected', clusterLabelPos:'top', class:'parentnode'});}
                else{g.setNode("Out["+a.id+"]", {label: "Cell ID: " + a.id,id:a.id+'cluster', clusterLabelPos:'top', class:'parentnode'});}
            }
        });

        //Label Styles should be set in text so that Dagre can properly size the nodes
        var labelstyles = 'font-family: monospace; fill: #D84315; font-size: 1.3em;';


        Object.keys(internal_nodes).forEach(function (a) {
            if(internal_nodes[a].length){
            var parent = 'Out['+a+']';
            var internal = parent + 'internal';
            //FIXME: We have to use IDs because clusters don't actually assign classes for some reason.. this is a shortcoming of DagreD3
            g.setNode(internal,{label:'Internal Nodes',id:'internal',clusterLabelPos:'top',labelStyle:'font-family:monospace;font-size:1.3em'});
            g.setParent(internal,parent);
                internal_nodes[a].forEach(function (t) {
                    g.setNode(internal+t,{label:t, class:'internalnode childnode', labelStyle:'font-family:monospace;fill:#303F9F;font-size:1.3em;'}); g.setParent(internal+t,internal);
            })
            }
        });

        Object.keys(output_nodes).forEach(function (a) {
            var parent = 'Out['+a+']';
            if(dataflow || selected){
                var cell = a+'-Cell';
                g.setNode(cell,{label:'Cell['+a+']',class:'childnode', labelStyle:labelstyles});
                g.setParent(cell,parent);

            }
            output_nodes[a].forEach(function (t) {
                var uuid = t.substr(4,6);
                if(/Out\[[a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9]\]/.test(t)){
                    g.setNode(uuid,{label:parent, class:'childnode', labelStyle:labelstyles}); g.setParent(uuid,parent);
                }
                else{
                    g.setNode(a+t,{label:t, class:'childnode', labelStyle:labelstyles}); g.setParent(a+t,parent);
                }

        }) });

        cell_links.forEach(function (a) {
            g.setEdge(a.source,a.target,{class:a.source.substr(0,6)+a.target.substr(0,6),id:a.source+a.target});
        });
        console.log(cell_list);
        console.log(output_nodes);
        console.log(cell_links);
        return g;
        };

    var create_dep_view = function(depdiv,dataflow,selected) {

        width = $(window).width() - margin.right - margin.left;
        height = $(window).height() - margin.top - margin.bottom;
        globaldf = dataflow;
        globalselect = selected;



        depdiv.style.zIndex = '100';
        depdiv.style.width = '100%';

        var sourcediv = d3.select('div.dep-div').append('div').attr("width", width + margin.right + margin.left).style('top',(150+height * .65 + margin.top + margin.bottom)+"px")
                .attr("id","source-code").style('background-color','white');

        sourcediv.append('p').attr('class','cellid').text("In []");

        sourcediv.append('pre').style('position','absolute').attr('class','CodeMirror-line pre-scrollable');

        d3.select('#source-code pre').text("Scroll over any cell to see the source code of that cell");

        var svg = d3.select("div.dep-div").append('div').attr('id','svg-div').append("svg")
                .attr("width", width + margin.right + margin.left)
                .attr("height", height * .65 + margin.top + margin.bottom)
                .attr("id","svg").on('contextmenu',function (){return false;}),
        inner =  svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");



        var g = create_node_relations(dataflow,selected);

        create_graph(svg,g,inner);
    };

     return {
        create_dep_div: create_dep_div,
        create_dep_view: create_dep_view,
         attach_controls: attach_controls,
    };
    });