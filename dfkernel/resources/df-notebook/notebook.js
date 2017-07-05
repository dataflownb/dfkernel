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
    'notebook/js/shortcuteditor'
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
    shortcuteditor
) {

    var Notebook = notebook.Notebook;
    var _SOFT_SELECTION_CLASS = 'jupyter-soft-selected';

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


});