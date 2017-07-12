define([
    'jquery',
    'base/js/utils',
    'base/js/security',
    'base/js/keyboard',
    'services/config',
    'notebook/js/mathjaxutils',
    'components/marked/lib/marked',
], function($, utils, security, keyboard, configmod, mathjaxutils, marked) {
    "use strict";

    
    OutputArea.prototype.handle_output = function (msg) {
        var json = {};
        var msg_type = json.output_type = msg.header.msg_type;
        var content = msg.content;
        switch(msg_type) {
        case "stream" :
            json.text = content.text;
            json.name = content.name;
            break;
        case "execute_result":
            // json.execution_count = content.execution_count;
            json.execution_count = null;
            json.uuid = content.execution_count
        case "update_display_data":
        case "display_data":
            json.transient = content.transient;
            json.data = content.data;
            json.metadata = content.metadata;
            break;
        case "error":
            json.ename = content.ename;
            json.evalue = content.evalue;
            json.traceback = content.traceback;
            break;
        default:
            console.error("unhandled output message", msg);
            return;
        }
        this.append_output(json);
    };

    OutputArea.prototype.append_execute_result = function (json) {
        // var n = json.execution_count || ' ';
        var n = json.uuid || ' ';
        var toinsert = this.create_output_area();
        this._record_display_id(json, toinsert);
        if (this.prompt_area) {
            toinsert.find('div.prompt')
                    .addClass('output_prompt')
                    .empty()
                    .append(
                      $('<bdi>').text('Out')
                    ).append(
                      '[' + n + ']:'
                    );
        }
        var inserted = this.append_mime_type(json, toinsert);
        if (inserted) {
            inserted.addClass('output_result');
        }
        this._safe_append(toinsert);
        // If we just output latex, typeset it.
        if ((json.data[MIME_LATEX] !== undefined) ||
            (json.data[MIME_HTML] !== undefined) ||
            (json.data[MIME_MARKDOWN] !== undefined)) {
            this.typeset();
        }
    };



})