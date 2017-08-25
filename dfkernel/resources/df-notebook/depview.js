define(["jquery",
    "base/js/namespace",
    '/kernelspecs/dfpython3/df-notebook/d3.v3.min.js',
    '/kernelspecs/dfpython3/df-notebook/dagre-d3.min.js'
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
            cell_child_nums = [];
        IPython.notebook.get_cells().forEach(function(a) {
            if (a.cell_type == 'code') {
                cell_list.push({id: a.uuid});
                a.cell_imm_upstream_deps.forEach(function (b) {
                    cell_links.push({source: b, target: a.uuid});
                });
            }
        });
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
            g.setNode(a.id, {label: a.id});
        });

        cell_links.forEach(function (a) {
            g.setEdge(a.source,a.target);
        });

        var render = new dagreD3.render();

        render(d3.select("svg g"),g);

        var xCenterOffset = (svg.attr("width") - g.graph().width) / 2;
        inner.attr("transform", "translate(" + xCenterOffset + ", 20)");
        svg.attr("height", g.graph().height + 40);


        svg.selectAll("g.node").on("click", function(){
            var dep_div = $('.dep-div')[0];
                dep_div.style.width = "0%";
                dep_div.zIndex = '-999';
                d3.select("div.dep-div svg").transition().delay(1000).remove();
                var node = d3.select(this),
                cellid = node.select('tspan').text();
            Jupyter.notebook.select_by_id(cellid);})
            .attr("title",function () {
                var node = d3.select(this),
                cellid = node.select('tspan').text();
            return (Jupyter.notebook.get_code_cell(cellid)).get_text();
        });

        $("g.node").tooltip();
    };

     return {
        create_dep_div: create_dep_div,
        create_dep_view: create_dep_view
    };
    });