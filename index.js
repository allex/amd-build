/**
 * AMD project dependences builder
 *
 * @author Allex Wang (allex.wxn@gmail.com)
 */

var fs = require('fs-x'),
    path = require('path'),
    util = require('./lib/util'),
    AMDParser = require('./lib/parser'),
    compress = require('./lib/compressor');

function Context(name) {
    this.name = name;
    this.length = 0;
    this._list = [];
    this._hash = {};
}

util.mixin(Context.prototype, {
    get: function(name) {
        return this._hash[name] || null;
    },
    has: function(name) {
        return !!this.get(name);
    },
    push: function(name) {
        var hash = this._hash, list = this._list, l;
        if (Array.isArray(name)) {
            name.forEach(function(name) {
                if (!hash[name]) {
                    hash[name] = name;
                    list.push(name);
                }
            });
        } else {
            if (!hash[name]) {
                hash[name] = name;
                list.push(name);
            }
        }
        this.length = list.length;
    },
    forEach: function(iterator) {
        this._list.forEach(iterator);
    },
    getDeps: function() {
        return this._list;
    }
});

function Build(srcDir, distDir, options) {
    if (!srcDir || !fs.existsSync(srcDir)) {
        throw Error('Source directory is not exist.');
    }
    if (!distDir) {
        throw Error('Dist directory not set.');
    }

    options = options || {};

    this.srcDir = srcDir;
    this.distDir = distDir;
    this.aliases = options.aliases || {};
    this.globalModule = 'lib/r.core';
    this.reserveModules = ['global', 'require', 'exports', 'module'];

    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir);
    }
    this.moduleInfo = {};
    this.cacheEnabled = options.cache;
}

util.mixin(Build.prototype, {
    init: function() {
        this.moduleInfo = (new AMDParser(this.srcDir, this.cacheEnabled ? this.distDir + '/cache.json' : null)).parse();
    },
    getModuleConfig: function(moduleName) {
        moduleName = this.resolveModule(moduleName);
        var conf = this.moduleInfo.modules[moduleName];
        if (!conf) {
            throw Error('module (name="' + moduleName + '") not exists.');
        }
        return conf;
    },
    /**
     * Find the specified module all dependences.
     *
     * @param {String} moduleName The module name to process.
     * @return {Array} Returns all of the dependences module list.
     */
    findAllDeps: function(moduleName) {
        moduleName = this.resolveModule(moduleName);
        var me = this,
            conf = me.getModuleConfig(moduleName),
            context = new Context(moduleName),
            deps = conf.deps.slice(),
            reserveModules = me.reserveModules,
            exists = function(name) {
                return context.has(name) || reserveModules.indexOf(name) > -1;
            };

        if (!exists(moduleName)) {
            context.push(moduleName);
        }
        (function process(deps) {
            if (deps.length) {
                var name = deps.shift(), conf;
                if (!exists(name)) {
                    name = me.resolveModule(name);
                    context.push(name);
                    // process submodule dependences in recursion
                    conf = me.getModuleConfig(name);
                    conf.deps.forEach(function(name) {
                        if (!exists(name)) {
                            deps.push(name);
                        }
                    });
                }
                process(deps);
            }
        })(deps);

        return context.getDeps();
    },
    /**
     * Find the specified module all dependences files.
     *
     * @param {String} moduleName The module name to process.
     * @return {Array} Returns all of the dependences file list.
     */
    findAllDepsFiles: function(moduleName) {
        var files = {}, list = [], deps = this.findAllDeps(moduleName), moduleInfo = this.moduleInfo.modules, l = deps.length, file;
        // list the files in FILO
        while (l--) {
            var file = (moduleInfo[deps[l]] || 0).file;
            if (file && !files.hasOwnProperty(file)) {
                files[file] = 1;
                list.push(file);
            }
        }
        return list;
    },
    /**
     * Resolve module name by aliases.
     */
    resolveModule: function(moduleName) {
        var modules = this.moduleInfo.modules;
        if (modules[moduleName]) {
            return moduleName;
        } else {
            var aliases = this.aliases;
            if (aliases[moduleName]) {
                return aliases[moduleName];
            }
        }
        throw Error('module (name="' + moduleName + '") cannot be resolved.');
    },
    /**
     * Resolve module file path by the module name defined.
     *
     * @param {String} name The module name.
     */
    resolvePath: function(name) {
        var modules = this.moduleInfo.modules, moduleName = this.resolveModule(name);
        if (modules[moduleName]) {
            return modules[moduleName].file;
        }
        return name + '.js';
    },

    /**
     * Returns page module list filter from generic modules `moduleInfo.modules`.
     * Normally referenced by page entry.
     *
     * @abstract
     * @return {Array} The entry module list.
     */
    getPageModules: function() {
        throw Error('getPageModules() not implement');
    },

    /**
     * Anylize page modules to publish.
     *
     * @return {Object} The page module maps
     * { name: ['abc/modue', 'foo/module'], ... }
     */
    anylizePageFiles: function() {
        var me = this, pageModules = me.getPageModules(), map = {}, filesRate = {}, totalScore = 0;

        function countScore(file) {
            var pagefiles;
            filesRate[file] = {score: 0, mods: []};
            for (var k in map) {
                if (map.hasOwnProperty(k)) {
                    pagefiles = map[k];
                    if (pagefiles.indexOf(file) > -1) {
                        ++filesRate[file].score;
                        filesRate[file].mods.push(k);
                    }
                }
            }
        }

        pageModules.forEach(function(name) {
            map[name] = me.findAllDepsFiles(name);
            ++totalScore;
        });

        // count files score order by page modules.
        var files = me.moduleInfo.files;
        Object.keys(files).forEach(countScore);

        var pagefiles, l, file, globals = [];
        for (var k in map) {
            if (map.hasOwnProperty(k)) {
                pagefiles = map[k];
                l = pagefiles.length;
                while (l--) {
                    file = pagefiles[l];
                    if (filesRate[file].score / totalScore > .5) {
                        globals.push(file);
                        pagefiles.splice(l, 1);
                    }
                }
            }
        }

        globals = util.unique(globals).sort();

        var globalModule = me.globalModule, corejs = globalModule + '.js', index = globals.indexOf(corejs);
        if (index !== -1) {
            // move r.core.js to top
            globals.splice(index, 1);
            globals.unshift(corejs);
        }
        map[globalModule] = globals;

        return map;
    },

    combineModules: function(maps) {
        var srcDir = this.srcDir, distDir = this.distDir;
        var resolvePath = function(name) { return path.join(srcDir, name); };
        util.forEach(maps, function(files, distName) {
            fs.combineSync(files.map(resolvePath), path.join(distDir, distName + '.js'));
        });
    },

    compilerDist: function(callback) {
        var files = fs.find(this.distDir, {type: 'file', extname: '.js'});
        // compile js
        (function next() {
            var f = files.pop();
            if (f) {
                var filename = path.basename(f), dir = path.dirname(f), newfile = path.resolve(dir, filename + '.min');
                if (!fs.existsSync(dir)) { fs.mkdirSync(dir); }
                compress.compressjs(f, newfile, function() {
                    fs.rmSync(f);
                    fs.renameSync(newfile, f);
                    console.log('Build ' + f);
                    next();
                });
            } else {
                callback && callback();
            }
        })();
    }
});

// Exports
module.exports = Build;
