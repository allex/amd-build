/**
 * Utility functions
 *
 * @author Allex (allex.wxn@gmail.com)
 */

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

