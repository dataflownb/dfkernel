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

    // var update_overflows = function() {
    //     /* css overflow by Josh Crozier
    //       https://stackoverflow.com/questions/34519511/smart-overflow-in-html-is-there-any-way-to-put-ellipsis-with-a-link-at#answer-34519915
    //     */
    //
    //     var overflows = $(".dataflow-toolbar-container .smart-overflow");
    //     overflows.each(function() {
    //         var el = $(this);
    //         var link = $('<a/>')
    //             .addClass('ellipsis-link')
    //             .attr('href', '#');
    //
    //         console.log("PRINTING ELEMENT:", el.get());
    //         console.log("WIDTHS:", el.width(), el.innerWidth());
    //         console.log("WIDTHS2:", el.get()[0].offsetWidth, el.get()[0].scrollWidth);
    //         if (el.get()[0].offsetWidth < el.get()[0].scrollWidth) {
    //             console.log("FOUND ONE!");
    //             link.click(function () {
    //                 console.log("GOT CLICK", this, $(this).parent())
    //                 // e.preventDefault();
    //                 $(this).parent().removeClass('smart-overflow');
    //             });
    //             el.append(link);
    //         }
    //     });
    // };
    //
    // var update_inputs = function(div, cell) {
    //     var inputs = $(div).find('#inputs-' + cell.uuid);
    //     inputs.text("Here is some really really adsfklhajsdlk;fjaksldjfklajsdklfjklasd;jf;l long text.");
    // };

    var setup_toolbar = function(div, cell) {
        var link = $("<link/>")
            .attr('type', 'text/css')
            .attr('rel', 'stylesheet')
            .attr('href', require.toUrl('./toolbar.css'));
        $("head").append(link);
        //
        // var container = $(div);
        // container.addClass('dataflow-toolbar-container');
        // var label_in = $('<div/>')
        //     .addClass('dependency-area')
        //     .addClass('smart-overflow')
        //     .attr('id', 'inputs-' + cell.uuid)
        //     .text("Inputs:");
        // var label_out = $('<div/>')
        //     .addClass('dependency-area')
        //     .addClass('smart-overflow')
        //     .attr('id', 'outputs-' + cell.uuid)
        //     .text("Outputs:");
        // var deps_up = $('<div/>')
        //     .addClass('dependency-area')
        //     .addClass('smart-overflow')
        //     .attr('id', 'upstreams-' + cell.uuid)
        //     .text("Upstream Cells:");
        // var deps_down = $('<div/>')
        //     .addClass('dependency-area')
        //     .addClass('smart-overflow')
        //     .attr('id', 'downstreams-' + cell.uuid)
        //     .text("Downstream Cells:");
        // container.append(label_in, label_out, deps_up, deps_down);
        var dfdiv = $('<div class="dftoolbar">');
        update_inputs(dfdiv, cell);
        update_outputs(dfdiv, cell);
        // add_buttons(div, cell);
        add_auto_update_checkbox(dfdiv, cell);
        $(div).append(dfdiv);
        //var uuid = cell.cell_imm_upstream_deps;
        //update_overflows(div);
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
                var label = $('<i class="fa-chevron-circle-up fa">');
                var links = $('<div class="dftoolbar-links">');
                input_div.append(label, links);
                // inputs.text("Inputs:");
                upstream_pairs.forEach(
                    function (v_arr) {
                        links.append(add_variable(v_arr[0], v_arr[1], notebook));
                    });
                var highlight = $('<button/>')
                    .addClass("btn btn-default btn-xs")
                    .append($('<i class="fa-angle-double-up fa">'));
                highlight.click(function() {
                    var upstreams = cell.dfgraph.all_upstream_cell_ids(cell.uuid);
                    console.log("UPSTREAMS:", upstreams);
                    notebook.select_cells_by_id(upstreams);
                    return false;
                });
                links.append(highlight);
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
                var label = $('<i class="fa-chevron-circle-down fa">');
                var links = $('<div class="dftoolbar-links">');
                output_div.append(label, links);
                // outputs.text("Outputs:");
                output_names.forEach(
                    function (v) {
                        links.append(add_variable(v));
                    });
                var highlight = $('<button/>')
                    .addClass("btn btn-default btn-xs")
                    .append($('<i class="fa-angle-double-down fa">'));
                highlight.click(function() {
                    var downstreams = cell.dfgraph.all_downstream(cell.uuid);
                    console.log("DOWNSTREAMS:", downstreams);
                    notebook.select_cells_by_id(downstreams);
                    return false;
                });
                links.append(highlight);
                container.append(output_div);
            }
        }
    };

    var add_auto_update_checkbox = function(div, cell) {
        var container = $(div);
        var checkdiv = $('<div class="dftoolbar-inline"/>');
        var label = $('<label/>')
                .addClass("form-check-label")
                .attr('for', 'auto-update-' + cell.uuid)
                .text('Auto-Update:');
        var checkbox = $('<input type="checkbox"/>')
                .addClass("form-check-input")
                .attr('id', 'auto-update-' + cell.uuid);
        checkdiv.append(label, checkbox);
        container.append(checkdiv);
    };

    var add_buttons = function(div, cell) {
        var container = $(div);
        // var button = $('<button />')
        //     .addClass('btn btn-default btn-xs')
        //     .text(i18n.msg._('Edit Attachments'))
        //     .click( function() {
        //       edit_attachments_dialog(cell);
        //       return false;
        //     });

        var up_button = $('<div/>').button({icons:{primary:'ui-icon-circle-arrow-n'}}).attr("title", "Highlight Upstream");
        var down_button = $('<div/>').button({icons:{primary:'ui-icon-circle-arrow-s'}}).attr("title", "Highlight Downstream");
        container.append(up_button, down_button);
    };

    var register = function (notebook) {
        CellToolbar.register_callback('dfkernel.deps', setup_toolbar);
        CellToolbar.register_preset(i18n.msg._('Dataflow'), ['dfkernel.deps'], notebook);
    };
    return {'register': register};
            // 'update_overflows': update_overflows};
});
