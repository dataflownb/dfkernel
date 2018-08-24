define([
    'jquery',
    'notebook/js/codecell',
    'base/js/namespace',
    'base/js/utils',
    'base/js/keyboard',
    'services/config',
    'notebook/js/cell',
    'notebook/js/outputarea',
    'notebook/js/completer',
    'notebook/js/celltoolbar',
    'codemirror/lib/codemirror',
    'codemirror/mode/python/python',
    'notebook/js/codemirror-ipython',
    './utils.js'
], function(
    $,
    codecell,
    Jupyter,
    utils,
    keyboard,
    configmod,
    cell,
    outputarea,
    completer,
    celltoolbar,
    CodeMirror,
    cmpython,
    cmip,
    dfutils
    ) {


    Jupyter._code_cell_loaded = true;
    var CodeCell = codecell.CodeCell;

    CodeCell.prototype.init_dfnb = function () {
        if (!("uuid" in this)) {
            this.uuid = this.notebook.get_new_id();
            this.kernel_notified = true;
            this.dfgraph = this.notebook.session.dfgraph;
            this.internal_nodes = [];
            this.code_cached = '';
            this.metadata.auto_update = false;
            this.metadata.force_cached = false;
            this.metadata.cell_status = 'new';
            this.had_error = false;
        }
    };

    (function (_super) {
        CodeCell.prototype.create_element = function () {
            // we know this is called by the constructor right
            // so we will do the init_dfnb code here
            // (cannot patch the CodeCell constructor...I think)
            if (!("uuid" in this)) {
                this.init_dfnb();
            }

            var _super_result = _super.apply(this, arguments);
            this.icon_status = $('<div></div>');
            this.set_icon_status("new");
            this.input.prepend(this.icon_status);
            var that = this;
            this.code_mirror.on('change', function () {
                var change_status_for_edited_cell = {
                    'new' : 'edited-new',
                    'success' : 'edited-success',
                    'error' : 'edited-error',
                    'saved-success' : 'edited-saved-success',
                    'saved-success-first-load' : 'saved-success',
                    'saved-error' : 'edited-saved-error',
                    'saved-error-first-load' : 'saved-error'
                };

                var revert_status_for_unedited_cell = {};
                Object.keys(change_status_for_edited_cell).forEach(
                    function(k) {
                        var v = change_status_for_edited_cell[k];
                        revert_status_for_unedited_cell[v] = k;
                    });
                //only if the input is not empty
                function update_icons(status_map, check_prefix, status_prefix) {
                    if (that.metadata.cell_status in status_map) {
                        that.set_icon_status( status_map[that.metadata.cell_status] );
                    }
                    var downstream = that.dfgraph.all_downstream(that.uuid);
                    for(var i = 0;i<downstream.length;i++) {
                        Jupyter.notebook.session.dfgraph.depview.decorate_cell(downstream[i],'changed-cell',true);
                        var cell = Jupyter.notebook.get_code_cell(downstream[i]);
                        if (cell !== null && cell.get_text() === cell.code_cached) {
                            if (cell.metadata.cell_status === check_prefix + 'success') {
                                cell.set_icon_status(status_prefix + 'success');
                            } else if (cell.metadata.cell_status === check_prefix + 'error') {
                                cell.set_icon_status(status_prefix + 'error');
                            }
                        }
                    }

                }
                if(that.get_text() !== that.code_cached) {
                    update_icons(change_status_for_edited_cell, '', 'edited-');
                    Jupyter.notebook.session.dfgraph.depview.decorate_cell(that.uuid,'changed-cell',true);
                }
                else if (that.get_text() === that.code_cached ||
                    that.get_text().trim().length === 0) {
                    update_icons(revert_status_for_unedited_cell, 'edited-', '');
                    Jupyter.notebook.session.dfgraph.depview.decorate_cell(that.uuid,'changed-cell',false);
                }
                that.kernel_notified = true;
            });

            this.element.attr('id', this.uuid);
            var aname = $('<a/>');
            aname.attr('name', this.uuid);
            this.element.append(aname);

            return _super_result;
        };
    }(CodeCell.prototype.create_element));

    (function(_super) {
        CodeCell.prototype.bind_events = function () {
            _super.apply(this,arguments);
            var that = this;
            var nb = Jupyter.notebook;
            //add event to be notified when cell is deleted
            that.events.on('delete.Cell', function(event,data) {
                if (data['cell'] === that) {
                    var horizontal_line = nb.insert_cell_above("raw",data['index']);
                    horizontal_line.inner_cell.height(1).css("backgroundColor","red");
                    horizontal_line.inner_cell[0].childNodes[1].remove();
                    horizontal_line.metadata.deletable = false;
                    horizontal_line.celltoolbar.element.remove();
                    //add the horizontal line into hl_list for undeletion
                    nb.metadata.hl_list[data['cell'].uuid] = horizontal_line;
                    //undeleted the cell once the corresponding red line is clicked
                    $(horizontal_line.inner_cell).parent().attr('id',data['cell'].uuid).click(function(event) {
                        Jupyter.notebook.undelete_selected_cell(data['cell'].uuid);
                    });
                }
            });
        };
    }(CodeCell.prototype.bind_events));

    CodeCell.prototype.update_last_executed = function() {
        var output_tags = this.notebook.get_cell_output_tags(this.uuid);
        if (output_tags.length === 0) {
            this.notebook.session.last_executed.unshift('Out[' + this.uuid+ ']');
        } else if (output_tags.length === 1) {
            this.notebook.session.last_executed.unshift(output_tags[0]);
        } else {
            this.notebook.session.last_executed.unshift('(' + output_tags.join(',') + ')');
        }
        if (this.notebook.session.last_executed.length > this.notebook.session.last_executed_num) {
            this.notebook.session.last_executed.pop();
        }
    };


    CodeCell.prototype.execute = function (stop_on_error) {
        if (!this.kernel) {
            console.log("Can't execute cell since kernel is not set.");
            return;
        }

        if (stop_on_error === undefined) {
            stop_on_error = true;
        }

        this.output_area.clear_output(false, true);
        var old_msg_id = this.last_msg_id;
        if (old_msg_id) {
            this.kernel.clear_callbacks_for_msg(old_msg_id);
            delete CodeCell.msg_cells[old_msg_id];
            this.last_msg_id = null;
        }
        if (this.get_text().trim().length === 0) {
            // nothing to do
            this.set_input_prompt(null);
            this.set_icon_status('success');
            return;
        }
        this.set_icon_status('executing');
        this.element.addClass("running");

        if (!("last_executed" in this.notebook.session)) {
            this.notebook.session.last_executed = [];
            this.notebook.session.last_executed_num = 3;
        }

        var callbacks = this.get_callbacks();

        var code_dict = this.notebook.get_code_dict();
        this.code_cached = this.get_text();
        var dfkernel_data = {"uuid": this.uuid,
            "code_dict": code_dict,
            "output_tags": this.notebook.get_output_tags(Object.keys(code_dict)),
            "auto_update_flags": this.notebook.get_auto_update_flags(),
            "force_cached_flags": this.notebook.get_force_cached_flags(),
        };
        this.last_msg_id = this.kernel.execute(this.get_text(), callbacks, {
            silent: false, store_history: true,
            stop_on_error: stop_on_error, user_expressions: {
                "__dfkernel_data__": dfkernel_data
            }
        });
        CodeCell.msg_cells[this.last_msg_id] = this;
        this.render();
        this.events.trigger('execute.CodeCell', {cell: this});
        var that = this;

        function handleFinished(evt, data) {
            if (that.kernel.id === data.kernel.id && that.last_msg_id === data.msg_id) {
                var errflag = false;
                (that.output_area.outputs).forEach(function (out) {
                    if (out.output_type == "error") {
                        errflag = true;
                    }
                });
                that.had_error = errflag;
                if (! errflag) {
                    that.update_last_executed();
                }
                that.events.trigger('finished_execute.CodeCell', {cell: that});
                that.events.off('finished_iopub.Kernel', handleFinished);
            }
        }
        this.events.on('finished_iopub.Kernel', handleFinished);
    };

    (function (_super) {
        CodeCell.prototype.get_callbacks = function () {
            var callbacks = _super.apply(this, arguments);
            var that = this;
            callbacks["iopub"]["output"] = function () {
                that.events.trigger('set_dirty.Notebook', {value: true});
                var cell = null;
                if (arguments[0].content.execution_count !== undefined) {
                    var execution_count = arguments[0].content.execution_count;
                    cell = that.notebook.get_code_cell(execution_count);
                }
                if (!cell) {
                    cell = that;
                }
                cell.output_area.handle_output.apply(cell.output_area, arguments);
            };

            callbacks["iopub"]["execute_input"] = function () {
                var cid = arguments[0].content.execution_count;
                var cell = that.notebook.get_code_cell(cid);
                if (cell) {
                    cell.output_area.clear_output(false, true);
                    cell.set_icon_status('executing');
                    cell.element.addClass("running");
                    cell.render();
                    that.events.trigger('execute.CodeCell', {cell: cell});
                }
            };
            return callbacks;
        }
    }(CodeCell.prototype.get_callbacks));

    (function (_super) {
        CodeCell.prototype._handle_execute_reply = function (msg) {
            var cc = this;

            /** Remove deleted cells from graph before any additional actions are taken **/
            (msg.content.deleted_cells || []).forEach(function (d_cell) {
                cc.dfgraph.remove_cell(d_cell);
            });

            var cell = this.notebook.get_code_cell(msg.content.execution_count);
            if (!cell) {
                cell = this;
            }
            if (msg.metadata.status != "error" && msg.metadata.status != "aborted") {
                var that = cell;
                //set input field icon to success if cell is executed
                cell.set_icon_status('success');

                /** Rename content for general readability*/
                var nodes = msg.content.nodes;
                var uplinks = msg.content.links;
                var cells = msg.content.cells;
                var downlinks = msg.content.imm_downstream_deps;
                var all_ups = msg.content.upstream_deps;
                var internal_nodes = msg.content.internal_nodes;
                this.dfgraph.update_graph(cells,nodes,uplinks,downlinks,cell.uuid,all_ups,internal_nodes);

                that.internal_nodes = msg.content.internal_nodes;


                if (msg.content.update_downstreams) {
                    this.dfgraph.update_down_links(msg.content.update_downstreams);

                }
            }
            else{
                //set input field icon to error if cell returns error
                cell.set_icon_status('error');
                var that = cell;
                this.dfgraph.remove_cell(that.uuid);
            }
            if(cell === cc){
                this.dfgraph.update_dep_view();
            }
            _super.apply(cell, arguments);
        }
    }(CodeCell.prototype._handle_execute_reply));

    (function (_super) {
        CodeCell.prototype.set_input_prompt = function (number) {
            if (number != '*') {
                number = this.uuid;
            }
            return _super.call(this, number);
        };
    }(CodeCell.prototype.set_input_prompt));

    (function (_super) {
        CodeCell.prototype.fromJSON = function (data) {
            //If something gets loaded in without a execution_count we want to make sure to assign it one
            var uuid = ((data.execution_count !== null) ? dfutils.pad_str_left(data.execution_count.toString(16),
                    this.notebook.get_default_id_length()) : Jupyter.notebook.get_new_id());
            data.outputs.forEach(function (out) {
                if (out.output_type === "execute_result") {
                    out.execution_count = uuid;
                }
            });


            _super.call(this, data);
            this.code_cached = this.get_text();
            this.metadata.cell_status = this.metadata.cell_status || 'edited-new';
            if(this.metadata.cell_status.indexOf('undelete-') !== -1) {
                this.metadata.cell_status = this.metadata.cell_status.substr(9);
            }
            this.set_icon_status(this.metadata.cell_status);
            if (!(this.metadata.auto_update)) {
                this.metadata.auto_update = false;
            }
            if (!(this.metadata.force_cached)) {
                this.metadata.force_cached = false;
            }
            this.uuid = uuid;
            this.element.attr('id', this.uuid);
            var aname = $('<a/>');
            aname.attr('name', this.uuid);
            this.element.append(aname);
            this.set_input_prompt();
            this.kernel_notified = true;

        };
    }(CodeCell.prototype.fromJSON));

    (function (_super) {
        CodeCell.prototype.toJSON = function () {
            data = _super.apply(this, arguments);
            // FIXME check that this won't exceed the size of int
            if (this.uuid === null) {
                this.uuid = Jupyter.notebook.get_new_id();
            }
            data.execution_count = parseInt(this.uuid, 16);
            data.outputs.forEach(function (out) {
                if (out.output_type === "execute_result") {
                    out.execution_count = data.execution_count;
                }
            });
            //set correct cell_status for saved codecell
            data = Jupyter.notebook.to_saved_cell_status(data,false);
            return data;
        }
    }(CodeCell.prototype.toJSON));

    CodeCell.prototype.set_icon_status = function(cell_status) {
        //FIXME update depview here
        var status_to_css_classes =
            {"new" : ["new-cell df-verified", "New"],
                "edited-new" : ["edited-new df-unverified", "Edited new"],
                "success" : ["success-cell df-verified", "Success"],
                "edited-success" : ["edited-success df-unverified", "Edited success"],
                "error" : ["error-cell df-error", "Error"],
                "edited-error" : ["edited-error df-unverified", "Edited error"],
                "saved-success" : ["saved-success df-unverified", "Saved success"],
                "edited-saved-success" : ["edited-saved-success df-unverified", "Edited saved success"],
                "executing" : ["executing df-unverified", "Executing"],
                "saved-error" : ["saved-error df-unverified", "Saved error"],
                "edited-saved-error" : ["edited-saved-error df-unverified", "Edited saved error"]
            };

        this.metadata.cell_status = cell_status;
        this.icon_status.removeClass()
            .addClass("icon_status")
            .addClass( status_to_css_classes[cell_status][0])
            .prop("title",status_to_css_classes[cell_status][1]);
    };
    return {CodeCell: CodeCell};
});
