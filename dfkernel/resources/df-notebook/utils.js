/**
 * Created by dkoop on 7/6/17.
 */
define(function() {
    "use strict";

    var pad_str_left = function(s, len, pad_char) {
        pad_char = (typeof pad_char !== 'undefined') ?  pad_char : "0";
        return (pad_char.repeat(len) + s).substr(-len);
    };

    var random_hex_str = function(len) {
        len = (typeof len !== 'undefined') ? len : 6;
        // generate value in [1, 0xf...f]
        var num = Math.floor(Math.random() * parseInt("f".repeat(len), 16)) + 1;
        return pad_str_left(num.toString(16), len);
    };
    
    return {
        pad_str_left: pad_str_left,
        random_hex_str: random_hex_str
    };
});
