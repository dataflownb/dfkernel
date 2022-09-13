define(['jquery',
        'base/js/namespace',
        'notebook/js/outputarea',
        'base/js/utils'
], function($, Jupyter,outputarea, utils) {
    "use strict";

    var OutputArea = outputarea.OutputArea;

    // define differently depending on whether i18n is installed (notebook v5.1+)
    require(['base/js/i18n'],
        function(i18n) {
            OutputArea.output_prompt_function = function (prompt_value, metadata) {
                if (metadata.output_tag) {
                    if(metadata.output_tag.substr(0,6) == prompt_value){
                        return $('<bdi>').text(i18n.msg.sprintf(i18n.msg._('Out[%s][%s]:'), prompt_value,metadata.output_tag.substr(6)));
                    }
                    return $('<bdi>').text(metadata.output_tag + ':');
                } else {
                    return $('<bdi>').text(i18n.msg.sprintf(i18n.msg._('Out[%s]:'), prompt_value));
                }
            };
        },
        function(err) {
            OutputArea.output_prompt_function = function (prompt_value, metadata) {
                if (metadata.output_tag) {
                    if(metadata.output_tag.substr(0,6) == prompt_value){
                        return $('<bdi>').text('Out['+prompt_value+']['+metadata.output_tag.substr(6)+']:');
                    }
                    return $('<bdi>').text(metadata.output_tag + ':');
                } else {
                    return $('<bdi>').text('Out[' + prompt_value + ']:');
                }
            };
        });

    // FIXME pull these in instead?
    // Declare mime type as constants
    var MIME_JAVASCRIPT = 'application/javascript';
    var MIME_HTML = 'text/html';
    var MIME_MARKDOWN = 'text/markdown';
    var MIME_LATEX = 'text/latex';
    var MIME_SVG = 'image/svg+xml';
    var MIME_PNG = 'image/png';
    var MIME_JPEG = 'image/jpeg';
    var MIME_PDF = 'application/pdf';
    var MIME_TEXT = 'text/plain';

    // only change is to pass the metadata to the prompt function!
    OutputArea.prototype.append_execute_result = function (json) {
        var n = json.execution_count || ' ';
        var codecell = Jupyter.notebook.get_code_cell(json.execution_count.toString(16));
        if(codecell !== null){
            codecell.set_icon_status('success');
            var replace = null;
            codecell.output_area.outputs.map(function (out,idx){
                if (out.metadata.output_tag == json.metadata.output_tag){
                    replace = idx;
            }
            });
            if(replace !== null) {
                var toinsert = codecell.output_area.create_output_area();
                codecell.output_area._record_display_id(json, toinsert);
                if (codecell.output_area.prompt_area) {
                    toinsert.find('div.prompt')
                            .addClass('output_prompt')
                            .empty()
                            .append(OutputArea.output_prompt_function(n, json.metadata));
                }
                var inserted = codecell.output_area.append_mime_type(json, toinsert);
                if (inserted) {
                    inserted.addClass('output_result');
                }
                codecell.output_area._safe_append(json,codecell.output_area.elements[replace]);

                // If we just output latex, typeset it.
                if ((json.data[MIME_LATEX] !== undefined) ||
                    (json.data[MIME_HTML] !== undefined) ||
                    (json.data[MIME_MARKDOWN] !== undefined)) {
                    codecell.output_area.typeset();
                }
                return;
            }
            else {
                if(this != codecell.output_area)
                {
                    codecell.output_area.append_execute_result(json);
                    return;
                }
            }
        }
        this.clear_output();
        var toinsert = this.create_output_area();
        this._record_display_id(json, toinsert);
        if (this.prompt_area) {
            toinsert.find('div.prompt')
                    .addClass('output_prompt')
                    .empty()
                    .append(OutputArea.output_prompt_function(n, json.metadata));
        }
        var inserted = this.append_mime_type(json, toinsert);
        if (inserted) {
            inserted.addClass('output_result');
        }
        this._safe_append(toinsert)
        // If we just output latex, typeset it.
        if ((json.data[MIME_LATEX] !== undefined) ||
            (json.data[MIME_HTML] !== undefined) ||
            (json.data[MIME_MARKDOWN] !== undefined)) {
            this.typeset();
        }
    };

    (function(_super) {
        OutputArea.prototype.create_output_area = function () {
            var oa = _super.call(this, arguments);
            if (this.prompt_area) {
                oa.prepend($('<div/>').addClass('icon_status'));
            }
            return oa;
        };
    }(OutputArea.prototype.create_output_area));

    return {OutputArea: OutputArea}
});