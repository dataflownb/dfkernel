/**
 * @module notebook
 */
define([
    'jquery',
    'notebook/js/notebook',
    'base/js/namespace',
    'underscore',
    'base/js/utils',
    'base/js/dialog',
    'notebook/js/cell',
    'notebook/js/textcell',
    'notebook/js/codecell',
    'moment',
    'services/config',
    'services/sessions/session',
    'notebook/js/celltoolbar',
    'components/marked/lib/marked',
    'codemirror/lib/codemirror',
    'codemirror/addon/runmode/runmode',
    'notebook/js/mathjaxutils',
    'base/js/keyboard',
    'notebook/js/tooltip',
    'notebook/js/celltoolbarpresets/default',
    'notebook/js/celltoolbarpresets/rawcell',
    'notebook/js/celltoolbarpresets/slideshow',
    'notebook/js/celltoolbarpresets/attachments',
    'notebook/js/celltoolbarpresets/tags',
    'notebook/js/scrollmanager',
    'notebook/js/commandpalette',
    'notebook/js/shortcuteditor',
    '/kernelspecs/dfpython3/df-notebook/utils.js'
], function (
    $,
    notebook,
    IPython,
    _,
    utils,
    dialog,
    cellmod,
    textcell,
    codecell,
    moment,
    configmod,
    session,
    celltoolbar,
    marked,
    CodeMirror,
    runMode,
    mathjaxutils,
    keyboard,
    tooltip,
    default_celltoolbar,
    rawcell_celltoolbar,
    slideshow_celltoolbar,
    attachments_celltoolbar,
    tags_celltoolbar,
    scrollmanager,
    commandpalette,
    shortcuteditor,
    dfutils
) {

    var Notebook = notebook.Notebook;
    var _SOFT_SELECTION_CLASS = 'jupyter-soft-selected';
    var _DEFAULT_ID_LENGTH = 6;

    Notebook.prototype.reload_notebook = function(data) {
        var kernelspec = this.metadata.kernelspec;
        var res = this.load_notebook_success(data);
        this.metadata.kernelspec = kernelspec;
        if (this.ncells() === 1 && this.get_cell(0).get_text() == "") {
            // Hack that seems to work to get the first cell into edit mode
            this.mode = 'command';
            this.select(0);
            this.edit_mode();
            this.mode = 'edit';
        }
        return res;
    };

    /**
     * Get all the code text from all CodeCells in the notebook
     *
     * @return {Map} a map with (uuid, code) key-value pairs
     */
    Notebook.prototype.get_code_dict = function () {
        var code_dict = {};
        this.get_cells().forEach(function (d) {
            if (d.cell_type == 'code' && d.was_changed) {
                code_dict[d.uuid] = d.get_text();
                d.was_changed = false;
            }
        });
        return code_dict;
    };

    Notebook.prototype.has_id = function(id) {
        return this.get_cells().some(function (d) {
            return (d.cell_type == 'code' && d.uuid == id);
        });
    };

    Notebook.prototype.get_new_id = function(len) {
        len = (typeof len !== 'undefined') ? len : this.get_default_id_length();

        // just generate until we don't overlap
        // (shouldn't be an issue for most notebooks)
        var new_id = null;
        do {
            new_id = dfutils.random_hex_str(len);
        } while (this.has_id(new_id));
        return new_id;
    };

    Notebook.prototype.get_default_id_length = function() {
        return _DEFAULT_ID_LENGTH;
    };

    Notebook.prototype.invalidate_cells = function() {
        this.get_cells().forEach(function (d) {
            if (d.cell_type == 'code') {
                d.was_changed = true;
            }
        });
    };

    Notebook.prototype.get_code_cell = function(uid) {
        var retval = this.get_cells().filter(function (d) {
            return (d.cell_type == 'code' && d.uuid == uid);
        });
        return (retval.length > 0) ? retval[0] : null;
    };

    Notebook.prototype.get_code_cell_index = function(uid) {
        var result = null;
        this.get_cell_elements().filter(function (index) {
            if ($(this).data("cell").cell_type == "code" &&
                $(this).data("cell").uuid == uid) {
                result = index;
            }
        });
        return result;
    };

    Notebook.prototype.scroll_to_cell_id = function(uid, time) {
        var index = this.get_code_cell_index(uid);
        return this.scroll_to_cell(index, time);
    };

    /**
     * Programmatically select a cell.
     *
     * @param {string} uuid - A cell's uuid
     * @param {bool} moveanchor – whether to move the selection
     *               anchor, default to true.
     * @return {Notebook} This notebook
     */
    Notebook.prototype.select_by_id = function (uuid, moveanchor) {
        var index = this.get_code_cell_index(uuid);
        this.select(index, moveanchor);
    };

    Notebook.prototype.select_cells_by_id = function (cids) {
        var that = this;
        this.get_cells().forEach(function(cell) {
            cell.element.removeClass(_SOFT_SELECTION_CLASS);
        });
        cids.forEach(function(cid) {
            var cell = that.get_code_cell(cid);
            cell.element.addClass(_SOFT_SELECTION_CLASS);
        });
    };

    /**
     * Execute cells corresponding to the given ids.
     *
     * @param {list} cids - ids of the cells to execute
     */
    Notebook.prototype.execute_cells_by_id = function (cids) {
        if (cids.length === 0) {
            return;
        }
        var that = this;
        cids.forEach(function(cid) {
           var cell = that.get_code_cell(cid);
           cell.execute();
        });

        this.select_by_id(cids[cids.length - 1]);
        this.command_mode();
        this.set_dirty(true);
    };

    Notebook.prototype.remap_pasted_ids = function() {
        if (this.clipboard !== null && this.paste_enabled) {
            var remap = {};
            var cell_data, i;
            // TODO make copy of the text on the clipboard?
            for (i = 0; i < this.clipboard.length; i++) {
                cell_data = this.clipboard[i];
                var uuid = dfutils.pad_str_left(cell_data.execution_count.toString(16),
                    this.get_default_id_length());
                if (this.has_id(uuid)) {
                    // need new id
                    var new_id = this.get_new_id();
                    remap[uuid] = new_id;
                    cell_data.execution_count = new_id;
                    cell_data.outputs.forEach(function (out) {
                        if (out.output_type === "execute_result") {
                            out.execution_count = uuid;
                        }
                    });
                }
            }

            for (i = 0; i < this.clipboard.length; i++) {
                cell_data = this.clipboard[i];
                if (cell_data.source !== undefined) {
                    cell_data.source = dfutils.rewrite_code_ids(cell_data.source, remap);
                }
            }
        }
    };

    (function(_super) {
        Notebook.prototype.paste_cell_above = function () {
            this.remap_pasted_ids();
            _super.apply(this, arguments);
        };
    }(Notebook.prototype.paste_cell_above));

    (function(_super) {
        Notebook.prototype.paste_cell_below = function () {
            this.remap_pasted_ids();
            _super.apply(this, arguments);
        };
    }(Notebook.prototype.paste_cell_below));

    (function(_super) {
        Notebook.prototype.paste_cell_replace = function () {
            this.remap_pasted_ids();
            _super.apply(this, arguments);
        };
    }(Notebook.prototype.paste_cell_replace));

});