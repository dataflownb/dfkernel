define([
    'jquery',
    'base/js/utils',
    './comm',
    './serialize',
    'base/js/events'
], function($, utils, comm, serialize, events) {
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

})