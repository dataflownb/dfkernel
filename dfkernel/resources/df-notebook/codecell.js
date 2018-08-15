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
            this.internal_nodes = [];
            this.cell_info_area = null;
            this.cell_imm_upstream_deps = [];
            this.cell_imm_downstream_deps = [];
            this.cell_upstream_deps = null;
            this.cell_downstream_deps = null;
            this.code_cached = '';
            this.metadata.cell_status = 0;
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
            var icon_status = $('<div></div>').addClass("icon_status new-cell verified");
            this.input.prepend(icon_status);
            var that = this;
            this.code_mirror.on('change', function () {
                //only if the input is not empty
                if(that.get_text() !== that.code_cached) {
                    switch(that.metadata.cell_status) {
                        case 0:
                            that.set_icon_status(1);
                            break;
                        case 2:
                            that.set_icon_status(3);
                            break;
                        case 4:
                            that.set_icon_status(5);
                            break;
                        case 6:
                            that.set_icon_status(7);
                            break;
                        case 9:
                            that.set_icon_status(6);
                            break;
                        case 10:
                            that.set_icon_status(11);
                            break;
                        case 11:
                            that.set_icon_status(12);
                            break;
                    }

                    var downstream = Jupyter.DfGraph.all_downstream(that.input_prompt_number);
                    for(var i = 0;i<downstream.length;i++) {
                        var cell = Jupyter.notebook.get_code_cell(downstream[i]);
                        if (cell.metadata.cell_status == 2) {
                            cell.set_icon_status(3);
                        }
                    }
                }
                else if (that.get_text() == that.code_cached || that.get_text().trim().length === 0) {
                    that.set_icon_status(that.metadata.cell_status-1);
                    var downstream = Jupyter.DfGraph.all_downstream(that.input_prompt_number);
                    for(var i = 0;i<downstream.length;i++) {
                        var cell = Jupyter.notebook.get_code_cell(downstream[i]);
                        if (cell.metadata.cell_status == 3) {
                            cell.set_icon_status(2);
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
            this.set_icon_status(2);
            return;
        }
        this.set_icon_status(8);
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
        this.set_icon_status(2);
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
                    cell.set_icon_status(8);
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
                Jupyter.DfGraph.update_graph(cells,nodes,uplinks,downlinks,cell.uuid,all_ups,internal_nodes);
                that.internal_nodes = msg.content.internal_nodes;
                that.cell_imm_upstream_deps = msg.content.imm_upstream_deps;


                if (msg.content.update_downstreams) {
                    Jupyter.DfGraph.update_down_links(msg.content.update_downstreams);

                }
                that.cell_imm_downstream_deps = msg.content.imm_downstream_deps;
                //set input field icon to success if cell is executed
                cell.set_icon_status(2);
            }
            else if(cell == this && msg.metadata.status == "error") {
                //set input field icon to error if cell returns error
                cell.set_icon_status(4);
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
            switch(this.metadata.cell_status) {
                case 0:
                case 1:
                case 5:
                case 6:
                case 7:
                case 9:
                case 10:
                case 11:
                case 12:
                    this.set_icon_status(this.metadata.cell_status);
                    break;
                case 2:
                    this.set_icon_status(9);
                    break;
                case 3:
                    this.set_icon_status(7);
                    this.code_cached = '';
                    break;
                case 4:
                    this.set_icon_status(10);
                    break;
                case 5:
                case 8:
                    this.set_icon_status(12);
                    break;
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
            return data;
        }
    }(CodeCell.prototype.toJSON));

    CodeCell.prototype.set_icon_status = function(cell_status) {
        //FIXME update depview here
        // 0 is new cell
        // 1 is edited from new cell
        // 2 is success, convert to 9 on save, on 1st change back to 6
        // 3 is edited from success
        // 4 is error, convert to 10 on save, on 1st edited 11
        // 5 is edited from error
        // 6 is success cell after loaded from saved notebook
        // 7 is edited from 6
        // 8 is executing
        // 9 is for saved success used for loading saved notebook
        // 10 is for saved error used for loading saved notebook
        // 11 is saved error cell, yellow times circle
        // 12 is edited from 11
        var i;
        var iconClass = ["new-cell", "edited-new", "success-cell", "edited-success",
                         "error-cell", "edited-error", "saved-success", "edited-saved",
                         "executing", "saved-success", "saved-error", "saved-error", "edited-saved"];
        var title = ["New", "Edited new", "Success", "Edited success",
                     "Error", "Edited error", "Saved success", "Edited saved",
                     "Executing", "Saved success", "Saved error", "Saved error", "Edited saved"];
        var colorClass = ["verified","unverified","error"];
        for(i=0;i<3;i++) {
            $('#'+this.uuid).find('.icon_status').removeClass(colorClass[i]);
        }
        if ([0,2].includes(cell_status)) {
            $('#'+this.uuid).find('.icon_status').addClass(colorClass[0]);
        } else if ( [1,3,5,6,7,8,9,10,11,12].includes(cell_status) ) {
            $('#'+this.uuid).find('.icon_status').addClass(colorClass[1]);
        } else if ( cell_status == 4 ) {
            $('#'+this.uuid).find('.icon_status').addClass(colorClass[2]);
        }
        for(i=0;i<13;i++) {
            $('#'+this.uuid).find('.icon_status').removeClass(iconClass[i]);
        }
        this.metadata.cell_status = cell_status;
        $('#'+this.uuid).find('.icon_status').addClass(iconClass[cell_status]).prop("title",title[cell_status]);
    }
    return {CodeCell: CodeCell};
});
