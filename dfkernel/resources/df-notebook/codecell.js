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
            this.was_changed = true;
            this.internal_nodes = [];
            this.cell_info_area = null;
            this.cell_imm_upstream_deps = [];
            this.cell_imm_downstream_deps = [];
            this.cell_upstream_deps = null;
            this.cell_downstream_deps = null;
            this.code_cached = '';
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

            var that = this;
            this.code_mirror.on('change', function () {
                //set input field background color to "yellow"
                //only if the input is not empty
                if (!(that.get_text().trim().length === 0)) {
                    if(that.get_text() !== that.code_cached) {
                        that.input.css("backgroundColor","rgba(255,255,0,0.2)");
                    }
                    else if (that.get_text() == that.code_cached) {
                        that.input.css("backgroundColor","white");
                    }                }
                that.was_changed = true;
            });

            this.create_df_info();

            this.element.attr('id', this.uuid);
            var aname = $('<a/>');
            aname.attr('name', this.uuid);
            this.element.append(aname);

            return _super_result;
        };
    }(CodeCell.prototype.create_element));

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
            return;
        }
        this.set_input_prompt('*');
        this.element.addClass("running");

        if (!("last_executed_i" in this.notebook.session)) {
            this.notebook.session.last_executed_iii = null;
            this.notebook.session.last_executed_ii = null;
            this.notebook.session.last_executed_i = null;
        }


        var callbacks = this.get_callbacks();

        var code_dict = this.notebook.get_code_dict();
        //reset input field color to white if cell is executed
        if (this.input.css("background-color") == "rgba(255, 255, 0, 0.2)") {
            this.input.css("backgroundColor", "white");
            cell.input_changed = false;
        }
        var output_tags = this.notebook.get_output_tags(Object.keys(code_dict));
        this.last_msg_id = this.kernel.execute(this.get_text(), callbacks, {
            silent: false, store_history: true,
            stop_on_error: stop_on_error, user_expressions: {
                '__uuid__': this.uuid,
                '__code_dict__': code_dict, '__output_tags__': output_tags
            }
        });
        this.code_cached = code_dict[this.uuid];
        CodeCell.msg_cells[this.last_msg_id] = this;
        this.render();
        this.events.trigger('execute.CodeCell', {cell: this});
        var that = this;

        function handleFinished(evt, data) {
            if (that.kernel.id === data.kernel.id && that.last_msg_id === data.msg_id) {
                that.events.trigger('finished_execute.CodeCell', {cell: that});
                that.events.off('finished_iopub.Kernel', handleFinished);
                var errflag = true;
                (that.output_area.outputs).forEach(function (out) {
                    if (out.output_type == "error") {
                        errflag = false;
                    }
                });
                //console.log(errflag)
                if (errflag) {
                    that.notebook.session.last_executed_iii = that.notebook.session.last_executed_ii;
                    that.notebook.session.last_executed_ii = that.notebook.session.last_executed_i;
                    that.notebook.session.last_executed_i = that.uuid;
                }
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
                    cell.clear_output_imm(false, true);
                    cell.set_input_prompt('*');
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
            var cell = this.notebook.get_code_cell(msg.content.execution_count);
            if (!cell) {
                cell = this;
            }
            if (cell == this && msg.metadata.status != "error") {
                var that = this;
                if('upstream_deps' in msg.content){
                    msg.content.upstream_deps.forEach(function (cid) {
                        var new_item = $('<li></li>');
                        var new_ahref = $('<a></a>');
                        var trailing = '';
                        if (cid.length > 6) {
                            trailing = '.' + cid.substr(6);
                            cid = cid.substr(0, 6);
                        }
                        new_ahref.attr('href', '#' + cid);
                        new_ahref.text("Cell[" + cid + "]" + trailing);
                        new_ahref.click(function () {
                            that.notebook.select_by_id(cid);
                            that.notebook.scroll_to_cell_id(cid);
                            return false;
                        });
                        new_item.append(new_ahref);
                        that.cell_upstream_deps.append(new_item);
                        $('.upstream-deps', that.cell_info_area).show();
                    });
                }

                if('downstream_deps' in msg.content) {
                    msg.content.downstream_deps.forEach(function (cid) {
                        var new_item = $('<li></li>');
                        var new_ahref = $('<a></a>');
                        new_ahref.attr('href', '#' + cid);
                        new_ahref.text("Cell[" + cid + "]");
                        new_ahref.click(function () {
                            that.notebook.select_by_id(cid);
                            that.notebook.scroll_to_cell_id(cid);
                            return false;
                        });
                        new_item.append(new_ahref);
                        that.cell_downstream_deps.append(new_item);
                        $('.downstream-deps', that.cell_info_area).show();
                    });
                }

                that.internal_nodes = msg.content.internal_nodes;
                that.cell_imm_upstream_deps = msg.content.imm_upstream_deps;


                if (msg.content.update_downstreams) {
                    msg.content.update_downstreams.forEach(function (t) {
                        var uuid = t['key'].substr(0, 6);
                        if(Jupyter.notebook.has_id(uuid) && t.data){
                            var upcell = Jupyter.notebook.get_code_cell(uuid);
                            if (upcell.cell_imm_downstream_deps) {
                                var updated = upcell.cell_imm_downstream_deps.concat(t['data']).reduce(function(a,b){if(!a.indexOf(b)+1){a.push(b);}return a;},[]);
                                upcell.cell_imm_downstream_deps = updated;
                            }
                            else {
                                upcell.cell_imm_downstream_deps = t['data'];
                            }
                        }
                    });
                }
                that.cell_imm_downstream_deps = msg.content.imm_downstream_deps;
            }
            //reset input field color to white if cell is executed
            if (cell.input.css("background-color") == "rgba(255, 255, 0, 0.2)") {
                cell.input.css("backgroundColor", "white");
                cell.input_changed = false;
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
            //we don't want to have all saved cell to have yellow input field
            if (!this.metadata.input_changed && this.input.css("background-color") == "rgba(255, 255, 0, 0.2)") {
                this.input.css("backgroundColor", "white");
            }
            this.uuid = uuid;
            this.element.attr('id', this.uuid);
            var aname = $('<a/>');
            aname.attr('name', this.uuid);
            this.element.append(aname);
            this.set_input_prompt();
            this.was_changed = true;

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

    return {CodeCell: CodeCell};
});
