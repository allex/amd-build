/**
 * AMD project module parser
 *
 * @author Allex (allex.wxn@gmail.com)
 */

var fs = require('fs-ext'),
    path = require('path'),
    amdutil = require('./amdutil');

var PARSER_VERSION = '1.0';

// simple mixin
function mixin(destination, source) {
    for (var k in source) {
        if (source.hasOwnProperty(k)) {
            destination[k] = source[k];
        }
    }
    return destination;
}

// generic forEach
function forEach(o, fn) {
    if (Array.isArray(o)) return o.forEach(fn);
    else for (var k in o) {
        if (o.hasOwnProperty(k)) {
            fn(o[k], k);
        }
    }
}

function Parser(dir, cachefile) {
    if (!dir || !fs.existsSync(dir)) {
        throw Error('The target project directory not exist.');
    }

    this._basedir = dir;
    this._cachefile = cachefile;
    this._cache = {
        version: PARSER_VERSION,
        basedir: path.resolve(dir),
        files: {},
        modules: {}
    };

    this.loadCache();
}

mixin(Parser.prototype, {
    loadCache: function() {
        var cache = this._cache, tmpObj = this.deserialize();
        if (tmpObj && tmpObj.version === cache.version) {
            this._cache = tmpObj;
        }
    },
    parse: function() {
        var base = this._basedir,
            offset = base.length + 1,
            cache = this._cache,
            files = cache.files || (cache.files = {}),
            modules = cache.modules || (cache.modules = {});

        fs.find(this._basedir, {type: 'file', extname: '.js', ignoreRe: /.git|.svn/}).forEach(function(f) {
            var filename = f.slice(offset), mods = amdutil.parseFile(f);
            forEach(mods, function(m, k) { m.path = filename; });
            files[filename] = {
                path: f,
                modules: Object.keys(mods),
                hash: fs.sha1sumSync(f),
            };
            mixin(modules, mods);
        });

        // serialize cache obj to cache file
        this.serialize(this._cachefile, cache);

        return cache;
    },
    serialize: function(file, obj) {
        file = file || this._cachefile;
        if (obj) {
            // normalize modules
            var modules = obj.modules;
            forEach(modules, function(v, k) {
                delete v['ast'];
            });
        }
        fs.writeJSONFileSync(file, obj);
        return file;
    },
    deserialize: function(file) {
        var cachefile = file || this._cachefile, cache;
        if (fs.existsSync(cachefile)) {
            cache = fs.readJSONFileSync(cachefile);
        }
        return cache;
    }
});

module.exports = Parser;
