define([
    'jquery',
    'base/js/utils',
    'base/js/keyboard',
    'notebook/js/contexthint',
    'codemirror/lib/codemirror',
], function($, utils, keyboard, CodeMirror) {
    "use strict";
    
    Completer.prototype.add_cell_ids = function(cell_str, start, end) {
        var piece = cell_str.slice(start, end);
        console.log('SEARCHING FOR "' + piece + '"');
        // take the notebook and lookup starts of uuids
        // add Out['[cell_id]'] to completions list
        var notebook = this.cell.notebook;

        if (piece == '') {
            return [];
        }

        if (piece.startsWith('_')) {
            var retval = [];
            if (((piece == '_') || (piece == '__') || (piece == '___')) && notebook.last_executed_iii) {
                retval.push(notebook.last_executed_iii)
            }
            if (((piece == '_') || (piece == '__')) && notebook.last_executed_ii) {
                retval.push(notebook.last_executed_ii)
            }
            if (((piece == '_')) && notebook.last_executed_i) {
                retval.push(notebook.last_executed_i);
            }

            return retval;
        }

        // be slow here
        var retval = notebook.get_cells()
            .filter(function (d) {
                return (d.cell_type == 'code' && d.uuid.startsWith(piece)); })
            .map(function(d) { return d.uuid; });
        return retval;
    }

    Completer.prototype.finish_completing = function (msg) {
        /**
         * let's build a function that wrap all that stuff into what is needed
         * for the new completer:
         */
        var content = msg.content;
        var start = content.cursor_start;
        var end = content.cursor_end;
        var matches = content.matches;
        console.log(content);

        var cur = this.editor.getCursor();
        if (end === null) {
            // adapted message spec replies don't have cursor position info,
            // interpret end=null as current position,
            // and negative start relative to that
            end = this.editor.indexFromPos(cur);
            if (start === null) {
                start = end;
            } else if (start < 0) {
                start = end + start;
            }
        } else {
            // handle surrogate pairs
            var text = this.editor.getValue();
            end = utils.char_idx_to_js_idx(end, text);
            start = utils.char_idx_to_js_idx(start, text);
        }

        var results = CodeMirror.contextHint(this.editor);
        var filtered_results = [];
        //remove results from context completion
        //that are already in kernel completion
        var i;
        for (i=0; i < results.length; i++) {
            if (!_existing_completion(results[i].str, matches)) {
                filtered_results.push(results[i]);
            }
        }

        // append the introspection result, in order, at at the beginning of
        // the table and compute the replacement range from current cursor
        // positon and matched_text length.
        var from = this.editor.posFromIndex(start);
        var to = this.editor.posFromIndex(end);
        for (i = matches.length - 1; i >= 0; --i) {
            filtered_results.unshift({
                str: matches[i],
                type: "introspection",
                from: from,
                to: to
            });
        }

        var cell_matches = this.add_cell_ids(this.editor.getValue(), start, end);
        cell_matches.forEach(function(cid) {
            filtered_results.unshift({
                str: "Out['" + cid + "']",
                type: "cell_id",
                from: from,
                to: to
            });
        });

        console.log(filtered_results);

        // one the 2 sources results have been merge, deal with it
        this.raw_result = filtered_results;

        // if empty result return
        if (!this.raw_result || !this.raw_result.length) return;

        // When there is only one completion, use it directly.
        if (this.autopick && this.raw_result.length == 1) {
            this.insert(this.raw_result[0]);
            return;
        }

        if (this.raw_result.length == 1) {
            // test if first and only completion totally matches
            // what is typed, in this case dismiss
            var str = this.raw_result[0].str;
            var pre_cursor = this.editor.getRange({
                line: cur.line,
                ch: cur.ch - str.length
            }, cur);
            if (pre_cursor == str) {
                this.close();
                return;
            }
        }

        if (!this.visible) {
            this.complete = $('<div/>').addClass('completions');
            this.complete.attr('id', 'complete');

            // Currently webkit doesn't use the size attr correctly. See:
            // https://code.google.com/p/chromium/issues/detail?id=4579
            this.sel = $('<select/>')
                .attr('tabindex', -1)
                .attr('multiple', 'true');
            this.complete.append(this.sel);
            this.visible = true;
            $('body').append(this.complete);

            //build the container
            var that = this;
            this.sel.click(function () {
                that.pick();
                that.editor.focus();
            });
            this._handle_keydown = function (cm, event) {
                that.keydown(event);
            };
            this.editor.on('keydown', this._handle_keydown);
            this._handle_keypress = function (cm, event) {
                that.keypress(event);
            };
            this.editor.on('keypress', this._handle_keypress);
        }
        this.sel.attr('size', Math.min(10, this.raw_result.length));

        // After everything is on the page, compute the postion.
        // We put it above the code if it is too close to the bottom of the page.
        var pos = this.editor.cursorCoords(
            this.editor.posFromIndex(start)
        );
        var left = pos.left-3;
        var top;
        var cheight = this.complete.height();
        var wheight = $(window).height();
        if (pos.bottom+cheight+5 > wheight) {
            top = pos.top-cheight-4;
        } else {
            top = pos.bottom+1;
        }
        this.complete.css('left', left + 'px');
        this.complete.css('top', top + 'px');

        // Clear and fill the list.
        this.sel.text('');
        this.build_gui_list(this.raw_result);
        return true;
    };

})