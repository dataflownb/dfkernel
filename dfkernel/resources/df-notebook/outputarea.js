define(['jquery',
        'notebook/js/outputarea',
        'base/js/utils',
        'base/js/i18n',
], function($, outputarea, utils, i18n) {
    "use strict";

    var OutputArea = outputarea.OutputArea;

    OutputArea.output_prompt_function = function(prompt_value) {
        return $('<bdi>').text(i18n.msg.sprintf(i18n.msg._('Out[%s]:'),prompt_value));
    };

});