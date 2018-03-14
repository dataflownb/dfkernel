/**
 * Created by dkoop on 7/6/17.
 */
define(function() {
    "use strict";

    var pad_str_left = function(s, len, pad_char) {
        pad_char = (typeof pad_char !== 'undefined') ?  pad_char : "0";
        return (pad_char.repeat(len) + s).substr(-len);
    };

    var random_hex_str = function(len, start_letter) {
        var num;
        len = (typeof len !== 'undefined') ? len : 6;
        if (start_letter || (start_letter === undefined)) {
            var start_num = parseInt("a" + "0".repeat(len-1), 16);
             num = Math.floor(Math.random() *
                    (parseInt("f".repeat(len), 16) - start_num)) + start_num;
            // no need to pad
            return num.toString(16);
        } else {
            // generate value in [1, 0xf...f]
            num = Math.floor(Math.random() * parseInt("f".repeat(len), 16)) + 1;
            return pad_str_left(num.toString(16), len);
        }
    };

    var CODE_REGEX = /(^|[^A-Za-z0-9_])Out\[[\'\"]?([0-9a-f]+)[\'\"]?\]/g;

    var rewrite_code_ids = function(code, map) {
        // replace allows a function that passes parenthesized submatches
        return code.replace(CODE_REGEX, function(s, g1, g2) {
            if (g2 in map) {
                return g1 + "Out[" + map[g2] + "]";
            } else {
                return s;
            }
        });
    };

    return {
        pad_str_left: pad_str_left,
        random_hex_str: random_hex_str,
        rewrite_code_ids: rewrite_code_ids
    };
});
