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

    // var ShortcutEditor = shortcuteditor.ShortcutEditor;
    // /**
    //  * Contains and manages cells.
    //  * @class Notebook
    //  * @param {string}          selector
    //  * @param {object}          options - Dictionary of keyword arguments.
    //  * @param {jQuery}          options.events - selector of Events
    //  * @param {KeyboardManager} options.keyboard_manager
    //  * @param {Contents}        options.contents
    //  * @param {SaveWidget}      options.save_widget
    //  * @param {object}          options.config
    //  * @param {string}          options.base_url
    //  * @param {string}          options.notebook_path
    //  * @param {string}          options.notebook_name
    //  */
    // function Notebook(selector, options) {
    //     this.config = options.config;
    //     this.class_config = new configmod.ConfigWithDefaults(this.config,
    //                                     Notebook.options_default, 'Notebook');
    //     this.base_url = options.base_url;
    //     this.notebook_path = options.notebook_path;
    //     this.notebook_name = options.notebook_name;
    //     this.events = options.events;
    //     this.keyboard_manager = options.keyboard_manager;
    //     this.contents = options.contents;
    //     this.save_widget = options.save_widget;
    //     this.tooltip = new tooltip.Tooltip(this.events);
    //     this.ws_url = options.ws_url;
    //     this._session_starting = false;
    //     this.last_modified = null;
    //     // debug 484
    //     this._last_modified = 'init';
    //     // Firefox workaround
    //     this._ff_beforeunload_fired = false;
    //
    //     //  Create default scroll manager.
    //     this.scroll_manager = new scrollmanager.ScrollManager(this);
    //
    //     // TODO: This code smells (and the other `= this` line a couple lines down)
    //     // We need a better way to deal with circular instance references.
    //     this.keyboard_manager.notebook = this;
    //     this.save_widget.notebook = this;
    //
    //     mathjaxutils.init();
    //
    //     if (marked) {
    //         marked.setOptions({
    //             gfm : true,
    //             tables: true,
    //             // FIXME: probably want central config for CodeMirror theme when we have js config
    //             langPrefix: "cm-s-ipython language-",
    //             highlight: function(code, lang, callback) {
    //                 if (!lang) {
    //                     // no language, no highlight
    //                     if (callback) {
    //                         callback(null, code);
    //                         return;
    //                     } else {
    //                         return code;
    //                     }
    //                 }
    //                 utils.requireCodeMirrorMode(lang, function (spec) {
    //                     var el = document.createElement("div");
    //                     var mode = CodeMirror.getMode({}, spec);
    //                     if (!mode) {
    //                         console.log("No CodeMirror mode: " + lang);
    //                         callback(null, code);
    //                         return;
    //                     }
    //                     try {
    //                         CodeMirror.runMode(code, spec, el);
    //                         callback(null, el.innerHTML);
    //                     } catch (err) {
    //                         console.log("Failed to highlight " + lang + " code", err);
    //                         callback(err, code);
    //                     }
    //                 }, function (err) {
    //                     console.log("No CodeMirror mode: " + lang);
    //                     console.log("Require CodeMirror mode error: " + err);
    //                     callback(null, code);
    //                 });
    //             }
    //         });
    //     }
    //
    //     this.element = $(selector);
    //     this.element.scroll();
    //     this.element.data("notebook", this);
    //     this.session = null;
    //     this.kernel = null;
    //     this.kernel_busy = false;
    //     this.clipboard = null;
    //     this.clipboard_attachments = null;
    //     this.undelete_backup_stack = [];
    //     this.paste_enabled = false;
    //     this.paste_attachments_enabled = false;
    //     this.writable = false;
    //     // It is important to start out in command mode to match the intial mode
    //     // of the KeyboardManager.
    //     this.mode = 'command';
    //     this.set_dirty(false);
    //     this.metadata = {};
    //     this._checkpoint_after_save = false;
    //     this.last_checkpoint = null;
    //     this.checkpoints = [];
    //     this.autosave_interval = 0;
    //     this.autosave_timer = null;
    //     // autosave *at most* every two minutes
    //     this.minimum_autosave_interval = 120000;
    //     this.notebook_name_blacklist_re = /[\/\\:]/;
    //     this.nbformat = 4; // Increment this when changing the nbformat
    //     this.nbformat_minor = this.current_nbformat_minor = 1; // Increment this when changing the nbformat
    //     this.codemirror_mode = 'text';
    //     this.create_elements();
    //     this.bind_events();
    //     this.kernel_selector = null;
    //     this.dirty = null;
    //     this.trusted = null;
    //     this._changed_on_disk_dialog = null;
    //     this._fully_loaded = false;
    //
    //     this.last_executed_i = null;
    //     this.last_executed_ii = null;
    //     this.last_executed_iii = null;
    //
    //     // Trigger cell toolbar registration.
    //     default_celltoolbar.register(this);
    //     rawcell_celltoolbar.register(this);
    //     slideshow_celltoolbar.register(this);
    //     attachments_celltoolbar.register(this);
    //     tags_celltoolbar.register(this);
    //
    //     var that = this;
    //
    //     Object.defineProperty(this, 'line_numbers', {
    //         get: function() {
    //             var d = that.config.data || {};
    //             var cmc =  (d['Cell'] || {}) ['cm_config'] || {};
    //             return cmc['lineNumbers'] || false;
    //         },
    //         set: function(value) {
    //             that.config.update({
    //                 'Cell': {
    //                     'cm_config': {
    //                         'lineNumbers':value
    //                     }
    //                 }
    //             });
    //         }
    //     });
    //
    //     Object.defineProperty(this, 'header', {
    //         get: function() {
    //             return that.class_config.get_sync('Header');
    //         },
    //         set: function(value) {
    //             that.class_config.set('Header', value);
    //         }
    //     });
    //
    //     Object.defineProperty(this, 'toolbar', {
    //         get: function() {
    //             return that.class_config.get_sync('Toolbar');
    //         },
    //         set: function(value) {
    //             that.class_config.set('Toolbar', value);
    //         }
    //     });
    //
    //     this.class_config.get('Header').then(function(header) {
    //         if (header === false) {
    //             that.keyboard_manager.actions.call('jupyter-notebook:hide-header');
    //         }
    //     });
    //
    //     this.class_config.get('Toolbar').then(function(toolbar) {
    //       if (toolbar === false) {
    //           that.keyboard_manager.actions.call('jupyter-notebook:hide-toolbar');
    //       }
    //     });
    //
    //     // prevent assign to miss-typed properties.
    //     Object.seal(this);
    // };

    Notebook.prototype.reload_notebook = function(data) {
        var kernelspec = this.metadata.kernelspec;
        var res = this.load_notebook_success(data);
        this.metadata.kernelspec = kernelspec;
        return res;
    }

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
    }

    Notebook.prototype.get_code_cell = function(uid) {
        var retval = this.get_cells().filter(function (d) {
            return (d.cell_type == 'code' && d.uuid == uid);
        });
        return (retval.length > 0) ? retval[0] : null;
    }

    /**
     * Programmatically select a cell.
     *
     * @param {string} uuid - A cell's uuid
     * @param {bool} moveanchor – whether to move the selection
     *               anchor, default to true.
     * @return {Notebook} This notebook
     */
    Notebook.prototype.select_by_id = function (uuid, moveanchor) {
        moveanchor = (moveanchor===undefined)? true : moveanchor;

        var cell = this.get_code_cell(uuid);
        if (cell) {
            var sindex = this.get_selected_index();
            var old_scell = this.get_cell(sindex);
            if (cell != old_scell) {
                if (this.mode !== 'command') {
                    this.command_mode();
                }
                this.get_cell(sindex).unselect(moveanchor);
            }
            if(moveanchor){
                this.get_cell(this.get_anchor_index()).unselect(moveanchor);
            }
            cell.select(moveanchor);
            this.update_soft_selection();
            if (cell.cell_type === 'heading') {
                this.events.trigger('selected_cell_type_changed.Notebook',
                    {'cell_type':cell.cell_type, level:cell.level}
                );
            } else {
                this.events.trigger('selected_cell_type_changed.Notebook',
                    {'cell_type':cell.cell_type}
                );
            }
        }
        return this;
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
     * @param {list} ids - ids of the cells to execute
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


})