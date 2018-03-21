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

    Kernel.prototype._handle_ws_message = function (e) {
        console.log("Should reach here");
        var that = this;
        this._msg_queue = this._msg_queue.then(function() {
            return serialize.deserialize(e.data);
        }).then(function(msg) {return that._finish_ws_message(msg);})
        .catch(function(error) { console.error("Couldn't process kernel message", error); });
    };

    Kernel.prototype._finish_ws_message = function (msg) {
        console.log(msg);
        switch (msg.channel) {
            case 'shell':
                return this._handle_shell_reply(msg);
            case 'iopub':
                return this._handle_iopub_message(msg);
            case 'stdin':
                return this._handle_input_request(msg);
            default:
                console.error("unrecognized message channel", msg.channel, msg);
        }
    };

})