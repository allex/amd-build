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
    var arr = [];
    for (var i = -1, l = array.length, el; ++i < l; ) {
        el = array[i];
        if (arr.indexOf(el) === -1) {
            arr.push(el);
        }
    }
    return arr;
};

// Assuming |array_of_dictionaries| is structured like this:
// [{id: 1, ... }, {id: 2, ...}, ...], you can use
// lookup(array_of_dictionaries, 'id', 2) to get the dictionary with id == 2.
exports.lookup = function(array_of_dictionaries, field, value) {
    var filter = function (dict) {return dict[field] == value;};
    var matches = array_of_dictionaries.filter(filter);
    if (matches.length == 0) {
        return undefined;
    } else if (matches.length == 1) {
        return matches[0]
    } else {
        throw new Error('Failed lookup of field "' + field + '" with value "' + value + '"');
    }
}
