define([
    'services/kernels/kernel',
    'jquery',
    'base/js/utils',
    'services/kernels/comm',
    'services/kernels/serialize',
    'base/js/events'
], function(kernel, $, utils, comm, serialize, events) {
    var Kernel = kernel.Kernel;
    "use strict";

     /**
     * Handle an input message (execute_input).
     *
     * @function _handle_input message
     */
    Kernel.prototype._handle_input_message = function (msg) {
        var callbacks = this.get_callbacks_for_msg(msg.parent_header.msg_id);
        if (!callbacks) {
            // The message came from another client. Let the UI decide what to
            // do with it.
            this.events.trigger('received_unsolicited_message.Kernel', msg);
        }
        var callback = callbacks.iopub.execute_input;
        if (callback) {
            callback(msg);
        }
    };

    Kernel.prototype.restart = function (success, error) {
        /**
         * POST /api/kernels/[:kernel_id]/restart
         *
         * Restart the kernel.
         *
         * @function interrupt
         * @param {function} [success] - function executed on ajax success
         * @param {function} [error] - functon executed on ajax error
         */
        this.events.trigger('kernel_restarting.Kernel', {kernel: this});
        this.stop_channels();
        this._msg_callbacks = {};
        this._msg_callbacks_overrides = {};
        this._display_id_to_parent_ids = {};

        var that = this;
        var on_success = function (data, status, xhr) {
            that.events.trigger('kernel_created.Kernel', {kernel: that});
            that._kernel_created(data);
            if (success) {
                success(data, status, xhr);
            }
            this.get_cells().forEach(function (d) {
            if (d.cell_type == 'code') {
                d.was_changed = true;
            }});
        };

        var on_error = function (xhr, status, err) {
            that.events.trigger('kernel_failed_restart.Kernel', {kernel: that});
            that._kernel_dead();
            if (error) {
                error(xhr, status, err);
            }
        };

        var url = utils.url_path_join(this.kernel_url, 'restart');
        utils.ajax(url, {
            processData: false,
            cache: false,
            type: "POST",
            contentType: false,  // there's no data with this
            dataType: "json",
            success: this._on_success(on_success),
            error: this._on_error(on_error)
        });
    };

})