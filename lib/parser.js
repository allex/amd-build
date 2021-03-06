/**
 * AMD project module parser
 *
 * @author Allex Wang (allex.wxn@gmail.com)
 */

var fs = require('fs-x'),
    path = require('path'),
    lang = require('lang-ext'),
    string = require('lang-ext/string'),
    amdutil = require('./amdutil');

var PARSER_VERSION = '1.0';

function Parser(dir, cachefile) {
    // Ensure dir path not end with '/'
    dir = string.rtrim(dir, path.sep);

    if (!dir || !fs.existsSync(dir)) {
        throw Error('The target project directory not exist.');
    }

    this.basedir = dir;
    this.cacheEnabled = !!cachefile;
    this._cachefile = cachefile;
    this._cache = {
        version: PARSER_VERSION,
        basedir: path.resolve(dir),
        files: {},
        modules: {}
    };

    if (this.cacheEnabled) {
        this.loadCache();
    }
}

lang.mix(Parser.prototype, {
    loadCache: function() {
        var cache = this._cache, tmpObj = this.deserialize();
        if (tmpObj && tmpObj.version === cache.version) {
            this._cache = tmpObj;
        }
    },
    parse: function() {
        var basedir = this.basedir,
            offset = basedir.length + 1,
            cache = this._cache,
            files = cache.files || (cache.files = {}),
            modules = cache.modules || (cache.modules = {});

        fs.find(basedir, {type: 'file', extname: '.js', ignoreRe: /.git|.svn/}).forEach(function(f) {
            var filename = f.slice(offset), mods;
            try {
                mods = amdutil.parseFile(f);
            }
            catch (e) {
                e = {
                    file: f,
                    line: e.line,
                    col: e.col,
                    pos: e.pos,
                    message: e.message
                };
                console.error('Parse error: ', e);
                return;
            }
            lang.forEach(mods, function(m, k) { m.file = filename; });
            files[filename] = {
                file: filename,
                modules: Object.keys(mods),
                hash: fs.sha1sumSync(f),
            };
            lang.mix(modules, mods);
        });

        if (this.cacheEnabled) {
            // serialize cache obj to cache file
            this.serialize(this._cachefile, cache);
        }

        return cache;
    },
    serialize: function(file, obj) {
        file = file || this._cachefile;
        if (obj) {
            // normalize modules
            var modules = obj.modules;
            lang.forEach(modules, function(v, k) { delete v['ast']; });
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

// Exports
module.exports = Parser;
