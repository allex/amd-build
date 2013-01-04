/**
 * Utility functions
 *
 * @author Allex (allex.wxn@gmail.com)
 */

var BLANK_CHAR = ' ';

// php rtrim
exports.rtrim = function(s, c) {
    c = c ? c : BLANK_CHAR;
    var i = s.length - 1;
    for (; i >= 0 && s.charAt(i) === c; ) --i;
    return s.substring(0, i + 1);
};

// php ltrim
exports.ltrim = function ltrim(s, c) {
    if (s.length === 0) return s;
    c = c ? c : BLANK_CHAR;
    var i = 0;
    for (; s.charAt(i) === c && i < s.length; ) ++i;
    return s.substring(i);
};

// simple mixin
exports.mixin = function(destination, source) {
    for (var k in source) {
        if (source.hasOwnProperty(k)) {
            destination[k] = source[k];
        }
    }
    return destination;
};

// generic forEach
exports.forEach = function(o, fn) {
    if (Array.isArray(o)) return o.forEach(fn);
    else for (var k in o) {
        if (o.hasOwnProperty(k)) {
            fn(o[k], k);
        }
    }
};

// unique array
exports.unique = function(array) {
    var m, n = [],
    o = {};
    for (var i = 0;
    (m = array[i]) !== undefined; i++) {
        if (!o[m]) {
            n.push(m);
            o[m] = true;
        }
    }
    return n;
};

