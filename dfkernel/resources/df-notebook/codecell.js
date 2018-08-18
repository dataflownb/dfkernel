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
            this.cell_info_area = null;
            this.cell_imm_upstream_deps = [];
            this.cell_imm_downstream_deps = [];
            this.cell_upstream_deps = null;
            this.cell_downstream_deps = null;
            this.code_cached = '';
            this.metadata.cell_status = 'new';
            this.had_error = false;
        }
    };

    CodeCell.prototype.create_df_info = function () {
        var that = this;
        var info = $('<div></div>').addClass("cellinfo");
        var downstream_h = $('<h5>Downstream Dependencies </h5>').addClass('downstream-deps');
        var downstream_button = $('<span/>').addClass("ui-button ui-icon ui-icon-triangle-1-e");
        downstream_h.prepend(downstream_button);
        var select_downstream = $('<a>Select All</a>');
        var update_downstream = $('<a>Update All</a>');
        downstream_h.append(select_downstream);
        downstream_h.append("&nbsp;");
        downstream_h.append(update_downstream);
        var downstream_list = $('<ul></ul>');
        info.append(downstream_h);
        info.append(downstream_list);
        update_downstream.click(function () {
            var cids = $('li a', downstream_list).map(function () {
                return $(this).attr('href').substring(1);
            }).get();
            that.notebook.execute_cells_by_id(cids);
            that.notebook.select_cells_by_id(cids);
        });
        select_downstream.click(function () {
            var cids = $('li a', downstream_list).map(function () {
                return $(this).attr('href').substring(1);
            }).get();
            that.notebook.select_cells_by_id(cids);
        });

        var upstream_h = $('<h5>Upstream Dependencies </h5>').addClass('upstream-deps');
        var upstream_button = $('<span/>').addClass("ui-button ui-icon ui-icon-triangle-1-e");
        upstream_h.prepend(upstream_button);
        var select_upstream = $('<a>Select All</a>');
        upstream_h.append(select_upstream);

        var upstream_list = $('<ul></ul>');
        info.append(upstream_h);
        info.append(upstream_list);

        select_upstream.click(function () {
            var cids = $('li a', upstream_list).map(function () {
                return $(this).attr('href').substring(1);
            }).get();
            that.notebook.select_cells_by_id(cids);
        });


        info.children('h5').click(function () {
            $(this).children('.ui-icon').toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
            $(this).next().toggle();
            return false;
        }).next().hide();

        $('.upstream-deps', info).hide();
        $('.downstream-deps', info).hide();

        this.cell_info_area = info;
        this.cell_upstream_deps = upstream_list;
        this.cell_downstream_deps = downstream_list;

        this.element.append(info);
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
            var icon_status = $('<div></div>').addClass("icon_status new-cell df-verified");
            this.input.prepend(icon_status);
            var that = this;
            this.code_mirror.on('change', function () {
                var change_status_for_edited_cell =
                {'new' : 'edited-new', 'success' : 'edited-success', 'error' : 'edited-error',
                 'saved-success' : 'edited-saved-success', 'saved-success-first-load' : 'saved-success',
                 'saved-error' : 'edited-saved-error', 'saved-error-first-load' : 'saved-error'};
                var revert_status_for_unedited_cell =
                {'edited-new': 'new', 'edited-success': 'success', 'edited-error': 'error',
                 'edited-saved-success': 'saved-success', 'saved-success': 'saved-success-first-load',
                 'edited-saved-error': 'saved-error', 'saved-error': 'saved-error-first-load'};
                //only if the input is not empty
                if(that.get_text() !== that.code_cached) {
                    console.log(that.metadata.cell_status);
                    if (that.metadata.cell_status in change_status_for_edited_cell) {
                        console.log(change_status_for_edited_cell[that.metadata.cell_status]);
                        that.set_icon_status( change_status_for_edited_cell[that.metadata.cell_status] );
                    }
                    var downstream = Jupyter.DfGraph.all_downstream(that.input_prompt_number);
                    for(var i = 0;i<downstream.length;i++) {
                        var cell = Jupyter.notebook.get_code_cell(downstream[i]);
                        if (cell.metadata.cell_status == 'success') {
                            cell.set_icon_status('edited-success');
                        }
                    }
                }
                else if (that.get_text() == that.code_cached || that.get_text().trim().length === 0) {
                    console.log(that.metadata.cell_status);
                    if (that.metadata.cell_status in revert_status_for_unedited_cell) {
                        console.log(revert_status_for_unedited_cell[that.metadata.cell_status]);
                        that.set_icon_status( revert_status_for_unedited_cell[that.metadata.cell_status] );
                    }
                    var downstream = Jupyter.DfGraph.all_downstream(that.input_prompt_number);
                    for(var i = 0;i<downstream.length;i++) {
                        var cell = Jupyter.notebook.get_code_cell(downstream[i]);
                        if (cell.metadata.cell_status == 'edited-success') {
                            cell.set_icon_status('success');
                        }
                    }
                }
                that.kernel_notified = true;
            });

            this.create_df_info();

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

        // this.output_area.clear_output(false, true);
        this.clear_output_imm(false, true);
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
        this.code_cached = code_dict[this.uuid];
        var output_tags = this.notebook.get_output_tags(Object.keys(code_dict));
        this.last_msg_id = this.kernel.execute(this.get_text(), callbacks, {
            silent: false, store_history: true,
            stop_on_error: stop_on_error, user_expressions: {
                '__uuid__': this.uuid,
                '__code_dict__': code_dict, '__output_tags__': output_tags
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
        //set input field icon to success if cell is executed
        this.set_icon_status('success');
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
                    cell.clear_output_imm(false, true);
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
            var cell = this.notebook.get_code_cell(msg.content.execution_count);
            if (!cell) {
                cell = this;
            }
            if (msg.metadata.status != "error") {
                var that = cell;

                /** Rename content for general readability*/
                var nodes = msg.content.nodes;
                var uplinks = msg.content.links;
                var cells = msg.content.cells;
                var downlinks = msg.content.imm_downstream_deps;
                var all_ups = msg.content.upstream_deps;
                var internal_nodes = msg.content.internal_nodes;
                this.dfgraph.update_graph(cells,nodes,uplinks,downlinks,cell.uuid,all_ups,internal_nodes);

                that.internal_nodes = msg.content.internal_nodes;
                that.cell_imm_upstream_deps = msg.content.imm_upstream_deps;


                if (msg.content.update_downstreams) {
                    this.dfgraph.update_down_links(msg.content.update_downstreams);

                }
                that.cell_imm_downstream_deps = msg.content.imm_downstream_deps;
                //set input field icon to success if cell is executed
                cell.set_icon_status('success');
            }
            else if(msg.metadata.status == "error") {
                //set input field icon to error if cell returns error
                cell.set_icon_status('error');
            }
            _super.apply(cell, arguments);
        }
    }(CodeCell.prototype._handle_execute_reply));


    CodeCell.prototype.update_df_list = function (cell,links,mode) {
        if(mode === 'upstream'){
            var listobj = cell.cell_upstream_deps;
            var classinfo = '.upstream-deps'
        }
        else if(mode === 'downstream'){
            var listobj = cell.cell_downstream_deps;
            var classinfo = '.downstream-deps'
        }

        links.forEach(function(cid) {
            cid = cid.substr(0,6);
            var new_item = $('<li></li>');
            var new_ahref = $('<a></a>');
            new_ahref.attr('href', '#' + cid);
            new_ahref.text("Cell[" + cid + "]");
            new_ahref.click(function () {
                cell.notebook.select_by_id(cid);
                cell.notebook.scroll_to_cell_id(cid);
                return false;
            });
            new_item.append(new_ahref);
            listobj.append(new_item);
            $(classinfo, cell.cell_info_area).show();
        });
    };


    (function (_super) {
        CodeCell.prototype.set_input_prompt = function (number) {
            if (number != '*') {
                number = this.uuid;
            }
            return _super.call(this, number);
        };
    }(CodeCell.prototype.set_input_prompt));

    CodeCell.prototype.clear_df_info = function () {
        $('.upstream-deps', this.cell_info_area).hide();
        $('.downstream-deps', this.cell_info_area).hide();
        $('.ui-icon', this.cell_info_area).removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-e');
        $(this.cell_upstream_deps).empty();
        $(this.cell_upstream_deps).hide();
        $(this.cell_downstream_deps).empty();
        $(this.cell_downstream_deps).hide();
    };

    CodeCell.prototype.clear_output_imm = function (wait, ignore_queue) {
        // like clear_output, but without the event
        this.output_area.clear_output(wait, ignore_queue);
        this.clear_df_info();
    };

    (function (_super) {
        CodeCell.prototype.clear_output = function (wait) {
            _super.apply(this, arguments);
            this.clear_df_info();
        };
    }(CodeCell.prototype.clear_output));

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
            this.set_icon_status(this.metadata.cell_status);
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
            return data;
        }
    }(CodeCell.prototype.toJSON));

    CodeCell.prototype.set_icon_status = function(cell_status) {
        //FIXME update depview here
        var status_to_css_classes =
         {"new" : ["new-cell df-verified", "New"], "edited-new" : ["edited-new df-unverified", "Edited new"],
          "success" : ["success-cell df-verified", "Success"], "edited-success" : ["edited-success df-unverified", "Edited success"],
          "error" : ["error-cell df-error", "Error"], "edited-error" : ["edited-error df-unverified", "Edited error"],
          "saved-success" : ["saved-success df-unverified", "Saved success"],
          "edited-saved-success" : ["edited-saved-success df-unverified", "Edited saved success"],
          "executing" : ["executing df-unverified", "Executing"], "saved-error" : ["saved-error df-unverified", "Saved error"],
          "edited-saved-error" : ["edited-saved-error df-unverified", "Edited saved error"]};

        $('#'+this.uuid).find('.icon_status').attr("class","icon_status");
        this.metadata.cell_status = cell_status;
        console.log(status_to_css_classes[cell_status]);
        $('#'+this.uuid).find('.icon_status').addClass( status_to_css_classes[cell_status][0] ).prop("title",status_to_css_classes[cell_status][1]);
    }
    return {CodeCell: CodeCell};
});
