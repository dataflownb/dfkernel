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
    './utils.js'
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
            if (d.cell_type === 'code' && d.was_changed) {
                code_dict[d.uuid] = d.get_text();
                d.was_changed = false;
            }
        });
        //if there are deleted cells, put it in the code_dict to update the dependencies' links
        if (this.metadata.hl_list) {
            for(cell_uuid in this.metadata.hl_list) {
                code_dict[cell_uuid] = "";
                var horizontal_line = this.metadata.hl_list[cell_uuid];
                delete this.metadata.hl_list[cell_uuid];
                var index = this.find_cell_index(horizontal_line);
                var ce = this.get_cell_element(index);
                ce.remove();
                // make sure that there is a new cell at the bottom
                if (index === (this.ncells()-1)) {
                    this.command_mode();
                    this.insert_cell_below();
                    this.select(index+1);
                    this.edit_mode();
                    this.scroll_to_bottom();
                    this.set_dirty(true);
                }
            }
        }
        return code_dict;
    };

    Notebook.prototype.get_cell_output_tags = function(uid) {
        var output_tags = [];
        var cell = this.get_code_cell(uid);
        if (cell) {
            return cell.output_area.outputs.map(function (d) {
                if (d.output_type === 'execute_result') {
                    var metadata = d.metadata;
                    if (metadata.output_tag) {
                        return metadata.output_tag;
                    }
                }
                return null;
            }).filter(function (d) {
                return d !== null
            });
        }
        return [];
    };

    Notebook.prototype.get_output_tags = function(uids) {
        var output_tags = {};
        var that = this;
        uids.forEach(function(uid) {
            output_tags[uid] = that.get_cell_output_tags(uid);
        });
        return output_tags;
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
            var copy = $.extend(true, [], this.clipboard);
            var cell_data, i;
            // TODO make copy of the text on the clipboard?
            for (i = 0; i < this.clipboard.length; i++) {
                cell_data = this.clipboard[i];
                if(cell_data.cell_type == 'code') {
                    var uuid = dfutils.pad_str_left(cell_data.execution_count.toString(16),
                        this.get_default_id_length());
                    //FIXME: Will this cause issues with speed?
                    this.undelete_backup_stack = this.undelete_backup_stack.map(
                        function(stack){
                        stack.cells = stack.cells.filter(
                            function(cell){
                                return cell.execution_count !== cell_data.execution_count;
                            });
                        return stack;
                    }).filter(function(stack){
                        return stack.cells.length > 0;
                    });
                    if (this.get_cells().some(function (d) {return (d.uuid == uuid);}))
                    {
                        // need new id
                        var new_id = this.get_new_id();
                        remap[uuid] = new_id;
                        cell_data.execution_count = new_id;
                        cell_data.outputs = [];
                    }
                }
            }
            for (i = 0; i < this.clipboard.length; i++) {
                cell_data = this.clipboard[i];
                if (cell_data.source !== undefined) {
                    cell_data.source = dfutils.rewrite_code_ids(cell_data.source, remap);
                }
            }
        }
        if (this.undelete_backup_stack.length === 0) {
                        $('#undelete_cell').addClass('disabled');
        }
        return copy;
    };

    (function(_super) {
        Notebook.prototype.paste_cell_above = function () {
            var copy = this.remap_pasted_ids();
            _super.apply(this, arguments);
            this.clipboard = copy;
        };
    }(Notebook.prototype.paste_cell_above));

    (function(_super) {
        Notebook.prototype.paste_cell_below = function () {
            var copy = this.remap_pasted_ids();
            _super.apply(this, arguments);
            this.clipboard = copy;
        };
    }(Notebook.prototype.paste_cell_below));

    (function(_super) {
        Notebook.prototype.save_notebook = function (check_last_modified) {
            //set input_changed so that we can load the saved notebook with the colored input field
            this.get_cells().forEach(function (d) {
                if (d.cell_type === 'code') {
                    if(d.metadata.cell_status == 2) {
                        d.metadata.cell_status = 9;
                    } else if(d.metadata.cell_status == 4) {
                        d.metadata.cell_status = 10;
                    }
                }
            });
            return _super.call(this, check_last_modified);
        };
    }(Notebook.prototype.save_notebook));

    (function(_super) {
        Notebook.prototype.paste_cell_replace = function () {
            var copy = this.remap_pasted_ids();
            _super.apply(this, arguments);
            this.clipboard = copy;
        };
    }(Notebook.prototype.paste_cell_replace));
    
    /**
     * Delete cells from the notebook
     *
     * @param {Array} [indices] - the numeric indices of cells to delete.
     * @return {Notebook} This notebook
     */
    Notebook.prototype.delete_cells = function(indices) {
        var that = this;
        //create a list of the horizontal lines for deleted cells
        if( typeof this.metadata.hl_list == 'undefined' && !(this.metadata.hl_list instanceof Array) ) {
            this.metadata.hl_list = [];
        }
        if (indices === undefined) {
            indices = this.get_selected_cells_indices();
        }
        var undelete_backup = {
            cells: [],
            below: false,
            index: 0,
        };

        var cursor_ix_before = this.get_selected_index();
        var deleting_before_cursor = 0;
        for (var i=0; i < indices.length; i++) {
            if (!this.get_cell(indices[i]).is_deletable()) {
                // If any cell is marked undeletable, cancel
                return this;
            }

            if (indices[i] < cursor_ix_before) {
                deleting_before_cursor++;
            }
        }

        // If we started deleting cells from the top, the later indices would
        // get offset. We sort them into descending order to avoid that.
        indices.sort(function(a, b) {return b-a;});
        for (i=0; i < indices.length; i++) {
            var cell = this.get_cell(indices[i]);
            undelete_backup.cells.push(cell.toJSON());
            var horizontal_line = that.insert_cell_below("raw",indices[i]);
            horizontal_line.inner_cell.height(1).css("backgroundColor","red");
            horizontal_line.inner_cell[0].childNodes[1].remove();
            //add the horizontal line into hl_list for undeletion
            this.metadata.hl_list[cell.uuid] = horizontal_line;
            //undeleted the cell once the corresponding red line is clicked
            $(horizontal_line.inner_cell).parent().attr('id',cell.uuid).click(function(event) {
                Jupyter.notebook.undelete_selected_cell(this.id);
            });
            this.get_cell_element(indices[i]).remove();
            this.events.trigger('delete.Cell', {'cell': cell, 'index': indices[i]});
        }

        var new_ncells = this.ncells();
        // Always make sure we have at least one cell.
        if (new_ncells === 0) {
            this.insert_cell_below('code');
            new_ncells = 1;
        }

        var cursor_ix_after = this.get_selected_index();
        if (cursor_ix_after === null) {
            // Selected cell was deleted
            cursor_ix_after = cursor_ix_before - deleting_before_cursor;
            if (cursor_ix_after >= new_ncells) {
                cursor_ix_after = new_ncells - 1;
                undelete_backup.below = true;
            }
            this.select(cursor_ix_after);
        }

        // Check if the cells were after the cursor
        for (i=0; i < indices.length; i++) {
            if (indices[i] > cursor_ix_before) {
                undelete_backup.below = true;
            }
        }

        // This will put all the deleted cells back in one location, rather than
        // where they came from. It will do until we have proper undo support.
        undelete_backup.index = cursor_ix_after;
        $('#undelete_cell').removeClass('disabled');

        this.undelete_backup_stack.push(undelete_backup);
        this.set_dirty(true);
        return this;
    };

    //undelete a cell if click on the horizontoal line
    Notebook.prototype.undelete_selected_cell = function(uuid) {
        var i ,j , cell_data, new_cell, insert;
        insert = $.proxy(this.insert_cell_below, this);
        for(i=0; i < this.undelete_backup_stack.length ; i++) {
            for(j=0; j < this.undelete_backup_stack[i].cells.length ; j++) {
                cell_data = this.undelete_backup_stack[i].cells[j];
                if (cell_data.execution_count.toString(16) == uuid) {
                    //get the clicked horizontal_line
                    var horizontal_line = this.metadata.hl_list[uuid];
                    delete this.metadata.hl_list[uuid];
                    var index = this.find_cell_index(horizontal_line);
                    //undelete the corresponding cell
                    new_cell = insert(cell_data.cell_type, index);
                    new_cell.fromJSON(cell_data);
                    //remove the horizontal line
                    var ce = this.get_cell_element(index);
                    ce.remove();
                    this.undelete_backup_stack[i].cells.splice(j,1);
                }
            }
        }
        this.set_dirty(true);
    };

    (function(_super) {
        Notebook.prototype.undelete_cell = function () {
            var j = this.undelete_backup_stack.length - 1
            var length = this.undelete_backup_stack[j].cells.length;
            for(i=0; i<length ; i++) {
                var uuid = this.undelete_backup_stack[j].cells[i].execution_count.toString(16);
                //remove the corresponding horizontal line if exist
                if (this.metadata.hl_list[uuid]) {
                    var horizontal_line = this.metadata.hl_list[uuid];
                    var index = this.find_cell_index(horizontal_line);
                    var ce = this.get_cell_element(index);
                    ce.remove();
                }
            }
            _super.apply(this, arguments);
        };
    }(Notebook.prototype.undelete_cell));

    (function(_super) {
        Notebook.prototype.insert_cell_at_index = function (type,index) {
            var cell = _super.call(this, type,index);
            if (cell.cell_type == "code") {
                cell.cell_status = 0;
                cell.input[0].childNodes[0].setAttribute("class","newCell");
            }
            return cell;
        };
    }(Notebook.prototype.insert_cell_at_index));

    return {Notebook: Notebook};

});
