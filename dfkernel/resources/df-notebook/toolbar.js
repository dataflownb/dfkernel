// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

define([
    'jquery',
    'require',
    'notebook/js/celltoolbar',
    'base/js/dialog',
    'base/js/i18n'
], function($, require, celltoolbar, dialog, i18n) {
    "use strict";

    var CellToolbar = celltoolbar.CellToolbar;

    var setup_toolbar = function(div, cell) {
        var link = $("<link/>")
            .attr('type', 'text/css')
            .attr('rel', 'stylesheet')
            .attr('href', require.toUrl('./toolbar.css'));
        $("head").append(link);

        var dfdiv = $('<div class="dftoolbar">');
        update_inputs(dfdiv, cell);
        update_outputs(dfdiv, cell);
        add_force_cached_button(dfdiv, cell);
        add_auto_update_button(dfdiv, cell);
        $(div).append(dfdiv);
    };

    var add_variable = function(name, cid, notebook) {
        var v = $('<button/>')
            .addClass("btn btn-default btn-xs")
            .text(name);
        if (cid) {
            v.click(function () {
                notebook.scroll_to_cell_id(cid);
                notebook.select_by_id(cid);
                return false;
            });
        }
        return v;
    };

    var update_inputs = function(div, cell) {
        if ('uuid' in cell) {
            var upstream_pairs = cell.dfgraph.get_imm_upstream_pairs(cell.uuid);
            if (upstream_pairs.length > 0) {
                var notebook = cell.notebook;
                var container = $(div);
                var input_div = $('<div class="dftoolbar-inline"/>');
                var highlight = $('<button/>')
                    .addClass("btn btn-default btn-xs")
                    .attr('title','Highlight Upstream Cells')
                    .append($('<i class="fa-chevron-circle-up fa">'));
                highlight.click(function() {
                    var upstreams = cell.dfgraph.all_upstream_cell_ids(cell.uuid);
                    notebook.select_cells_by_id(upstreams);
                    return false;
                });
                input_div.append(highlight);
                var links = $('<div class="dftoolbar-links dftoolbar-inputs">');
                input_div.append(links);
                upstream_pairs.forEach(
                    function (v_arr) {
                        links.append(add_variable(v_arr[0], v_arr[1], notebook));
                    });
                container.append(input_div);
            }
        }
    };

    var update_outputs = function(div, cell) {
        if ('uuid' in cell) {
            var output_names = cell.dfgraph.get_nodes(cell.uuid);
            if (output_names.length > 0) {
                var container = $(div);
                var notebook = cell.notebook;
                var output_div = $('<div class="dftoolbar-inline"/>');
                var highlight = $('<button/>')
                    .addClass("btn btn-default btn-xs")
                    .attr('title', 'Highlight Downstream Cells')
                    .append($('<i class="fa-chevron-circle-down fa">'));
                highlight.click(function() {
                    var downstreams = cell.dfgraph.all_downstream(cell.uuid);
                    notebook.select_cells_by_id(downstreams);
                    return false;
                });
                output_div.append(highlight);

                var links = $('<div class="dftoolbar-links dftoolbar-outputs">');
                output_div.append(links);
                output_names.forEach(
                    function (v) {
                        links.append(add_variable(v));
                    });
                container.append(output_div);
            }
        }
    };

    var add_auto_update_button = function(div, cell) {
        var container = $(div);
        var refresh = $('<button/>')
            .addClass("btn btn-default btn-xs")
            .attr('title', 'Auto-Refresh on Upstream Update')
            .append($('<i class="fa-refresh fa">'));
        if (cell.auto_update) {
            refresh.addClass('active');
        }
        refresh.click(function() {
            refresh.toggleClass('active');
            cell.auto_update = refresh.hasClass('active');
            return false;
        });
        container.append(refresh);
    };

    var add_force_cached_button = function(div, cell) {
        var container = $(div);
        var prompt = $('<button/>')
            .addClass("btn btn-default btn-xs")
            .attr('title', 'Only Update Explicitly')
            .append($('<i class="fa-database fa">'));
        if (cell.force_cached) {
            prompt.addClass('active');
        }
        prompt.click(function() {
            prompt.toggleClass('active');
            cell.force_cached = prompt.hasClass('active');
            return false;
        });
        container.append(prompt);
    };

    var register = function (notebook) {
        CellToolbar.register_callback('dfkernel.deps', setup_toolbar);
        CellToolbar.register_preset(i18n.msg._('Dataflow'), ['dfkernel.deps'], notebook);
    };
    return {'register': register};
});
