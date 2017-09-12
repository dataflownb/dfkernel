define(["jquery",
    "base/js/namespace",
    '/kernelspecs/dfpython3/df-notebook/d3.v3.min.js',
    '/kernelspecs/dfpython3/df-notebook/dagre-d3.min.js',
    '/kernelspecs/dfpython3/df-notebook/tooltipsy.min.js'
    ],
    function($, Jupyter, d3, dagreD3) {
    "use strict";

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
            closebtn.onclick = function() {
                var dep_div = $('.dep-div')[0];
                dep_div.style.width = "0%";
                dep_div.zIndex = '-999';
                d3.select("div.dep-div svg").transition().delay(1000).remove();
            };
            depdiv.append(closebtn);
            $('body').append(depdiv);

            return depdiv;
        };

    var create_dep_view = function(depdiv) {
        var cell_links = [],
            cell_list = [],
            cell_child_nums = [],
            output_nodes = [];
        Jupyter.notebook.get_cells().forEach(function(a) {
            if (a.cell_type == 'code') {
                if((a.output_area.outputs).length >= 1) {
                    output_nodes[a.uuid] = a.output_area.outputs.reduce(function (c, d) {
                        return c.concat(d.metadata.output_tag || ("Out[" + a.uuid + "]"));
                    }, []);
                }
                cell_list.push({id: a.uuid});
                a.cell_imm_upstream_deps.forEach(function (b) {
                    cell_links.push({source: b, target: a.uuid});
                });
            }
        });
        console.log(output_nodes);
        cell_list.forEach(function(a) {cell_child_nums[a.id] = 0;});
        cell_links.forEach(function(a){ cell_child_nums[a.source] += 1;});

        depdiv.style.zIndex = '100';
        depdiv.style.width = '100%';

        var margin = {top:20, right:120, bottom:20, left: 120},
            width = 800 - margin.right - margin.left,
            height = 600 - margin.top - margin.bottom;


        var svg = d3.select("div.dep-div").append("svg")
                .attr("width", width + margin.right + margin.left)
                .attr("height", height + margin.top + margin.bottom),
        inner =  svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var g = new dagreD3.graphlib.Graph().setGraph({}).setDefaultEdgeLabel(function () {
            return {};
        });

        cell_list.forEach(function(a){
            g.setNode(a.id, {label: "Cell ID: " + a.id + '\nOutputs:' + [].concat.apply(output_nodes[a.id] || "")});
        });

        g.nodes().forEach(function(v) {
            var node = g.node(v);
            // Round the corners of the nodes
            node.rx = node.ry = 5;
        });

        cell_links.forEach(function (a) {
            g.setEdge(a.source,a.target);
        });

        var zoom = d3.behavior.zoom().on("zoom", function() {
            inner.attr("transform", "translate(" + d3.event.translate + ")" +
                "scale(" + d3.event.scale + ")");
        });
        svg.call(zoom);

        var render = new dagreD3.render();

        render(d3.select("svg g"),g);

        var initialScale = 0.75;
        zoom
            .translate([(svg.attr("width") - g.graph().width * initialScale) / 2, 20])
            .scale(initialScale)
            .event(svg);
        svg.attr('height', g.graph().height * initialScale + 40);


        var tooltipstyle = function(cellid,source){
            return "<p class ='cellid'>Cell: " + cellid + "</p><p class='source'>Source:\n" + source + "</p>";
        };

        svg.selectAll("g.node").on("click", function(){
            var dep_div = $('.dep-div')[0];
                dep_div.style.width = "0%";
                dep_div.zIndex = '-999';
                d3.select("div.dep-div svg").transition().delay(1000).remove();
                var node = d3.select(this),
                cellid = node.select('tspan').text();
                Jupyter.notebook.select_by_id(cellid);
                Jupyter.notebook.scroll_to_cell_id(cellid);
        })
            .attr("title",function () {
                var node = d3.select(this),
                cellid = node.select('tspan').text().substr("Cell ID: ".length,6);
            return tooltipstyle(cellid,Jupyter.notebook.get_code_cell(cellid).get_text());
        }).on("mouseover",function(){
            d3.select(this).select("rect").style({"stroke":"green"});
        }).on("mouseout",function(){
            d3.select(this).select("rect").style({"stroke":"#999"});
        }).each(function () {
            $(this).tooltipsy({
                css: {
                    'padding': '10px',
                    'color': '#303030',
                    'background-color': '#000',
                    'border': '1px solid #999',
                    '-moz-box-shadow': '0 0 10px rgba(0, 0, 0, .5)',
                    '-webkit-box-shadow': '0 0 10px rgba(0, 0, 0, .5)',
                    'box-shadow': '0 0 10px rgba(0, 0, 0, .5)',
                    'text-shadow': 'none'
                }
            });
        });


        $("g.node").tooltip();
    };

     return {
        create_dep_div: create_dep_div,
        create_dep_view: create_dep_view
    };
    });