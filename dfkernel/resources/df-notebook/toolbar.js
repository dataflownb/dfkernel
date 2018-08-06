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
        // var link = $("<link/>")
        //     .attr('type', 'text/css')
        //     .attr('rel', 'stylesheet')
        //     .attr('href', require.toUrl('./toolbar.css'));
        // $("head").append(link);
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
        add_auto_update_checkbox(div, cell);
        //var uuid = cell.cell_imm_upstream_deps;
        update_inputs(div, cell);
        //update_overflows(div);
    };

    var add_variable = function(name) {
        return $('<button/>')
            .addClass("btn btn-default btn-xs")
            .text(name)
            .click( function () {
                //goto_cell(cell);
                return false;
            });
    };

    var update_inputs = function(div, cell) {
        var container = $(div);
        var inputs = $("<div/>");
        inputs.text("Inputs:")
        inputs.append(add_variable('i'), add_variable('j'))
        container.append(inputs);
    };

    var add_auto_update_checkbox = function(div, cell) {
        var container = $(div);
        var checkdiv = $('<div/>');
        var checkbox = $('<input type="checkbox"/>')
                .addClass("form-check-input")
                .attr('id', 'auto-update-' + cell.uuid);
        var label = $('<label/>')
                .addClass("form-check-label")
                .attr('for', 'auto-update-' + cell.uuid)
                .text('Auto-Update');
        checkdiv.append(checkbox, label);
        container.append(checkdiv);
    };

    var register = function (notebook) {
        CellToolbar.register_callback('dfkernel.deps', setup_toolbar);
        CellToolbar.register_preset(i18n.msg._('Dataflow'), ['dfkernel.deps'], notebook);
    };
    return {'register': register};
            // 'update_overflows': update_overflows};
});
