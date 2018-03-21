define([
    'notebook/js/outputarea',
    'jquery',
    'base/js/utils',
    'base/js/i18n',
    'base/js/security',
    'base/js/keyboard',
    'services/config',
    'notebook/js/mathjaxutils',
    'components/marked/lib/marked',
], function(outputarea, $, utils, i18n, security, keyboard, configmod, mathjaxutils, marked) {
    "use strict";

    var OutputArea = outputarea.OutputArea;

    OutputArea.output_prompt_function = function(prompt_value) {
        return $('<bdi>').text(i18n.msg.sprintf(i18n.msg._('Out[%s]:'),prompt_value));
    };

    // OutputArea.prototype.append_unrecognized = function (json) {
    //     console.log("Also reached");
    //     var that = this;
    //     var toinsert = this.create_output_area();
    //     var subarea = $('<div/>').addClass('output_subarea output_unrecognized');
    //     toinsert.append(subarea);
    //     subarea.append(
    //         $("<a>")
    //             .attr("href", "#")
    //             .text(i18n.msg.sprintf(i18n.msg._("Unrecognized output: %d"),json.output_type))
    //             .click(function () {
    //                 that.events.trigger('unrecognized_output.OutputArea', {output: json});
    //             })
    //     );
    //     this._safe_append(toinsert);
    // };

    });