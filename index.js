/**
 * AMD project dependences builder
 *
 * @author Allex Wang (allex.wxn@gmail.com)
 */

var fs = require('fs-x'),
    path = require('path'),
    lang = require('lang-ext'),
    array = require('lang-ext/array'),
    AMDParser = require('./lib/parser'),
    compress = require('jscss-compressor');

/**
 * AttributeCore provides the lightest level of configurable attribute support. It is designed to be 
 * augmented on to a host class, and provides the host with the ability to configure 
 * attributes to store and retrieve state, <strong>but without support for attribute change events</strong>.
 *
 * @constructor
 * @private
 */
var Attribute = function(attrs, values) {
    this._attrData = {};
};
Attribute.prototype = {
    get: function(key) {
        return this._attrData[key];
    },
    set: function(key, value) {
        this._attrData[key] = value;
    }
};

/**
 * AMD context modal. for amd dependences collection manage.
 *
 * @constructor
 * @private
 */
var Context = function(name) {
    this.name = name;
    this.length = 0;
    this._list = [];
    this._hash = {};
};
Context.prototype = {
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
};

/**
 * Base class for project build extends.
 *
 * @class Build
 * @constructor
 * @author Allex Wang (allex.wxn@gmail.com)
 */
function Build(basepath, distpath, options) {
    if (!basepath || !fs.existsSync(basepath)) {
        throw Error('Source directory is not exist.');
    }
    if (!distpath) {
        throw Error('Output path directory not valid.');
    }

    // Ensure output dir exist.
    if (!fs.existsSync(distpath)) {
        fs.mkdirSync(distpath);
    }

    // Merge defaults options.
    options = lang.merge(options, {
        cache: false,
        aliases: {},
        globalModuleName: 'r.core'
    });

    this.basepath = basepath;
    this.distpath = distpath;

    this.aliases = options.aliases;
    this.globalModuleName = options.globalModuleName;

    var reserveModules = ['global', 'require', 'exports', 'module'], reserves = options.reserveModules;
    if (reserves && reserves.length) {
        reserveModules = array.unique(reserveModules.concat(reserves));
    }
    this.reserveModules = reserveModules;

    var parser = new AMDParser(basepath, options.cache ? distpath + '/.cache.json' : null);
    this.moduleInfo = parser.parse();
}

lang.mix(Build.prototype, {

    /*
     * Get the dependences of a specified module.
     *
     * @public
     * @method getDeps
     * @param {String} moduleName The module name to process.
     * @return {Array} The duplicate reference of dependences list.
     */
    getDeps: function(moduleName) {
        return this._getModuleInfo(moduleName).deps.concat();
    },

    /**
     * Find all dependences list of the specified module.
     *
     * @public
     * @param {String} moduleName The module name to process.
     * @return {Array} Returns all of the dependences module list.
     */
    findAllDeps: function(moduleName) {
        moduleName = this.resolveModule(moduleName);

        var me = this,
            context = new Context(moduleName),
            deps = me.getDeps(moduleName),
            reserveModules = me.reserveModules,
            exists = function(name) { return context.has(name) || reserveModules.indexOf(name) > -1; };

        (function process(deps) {
            if (deps.length) {
                var name = deps.shift(), subDeps;
                if (!exists(name)) {
                    name = me.resolveModule(name);
                    context.push(name);
                    // process submodule dependences in recursion
                    subDeps = me.getDeps(name);
                    subDeps.forEach(function(n) {
                        if (!exists(n)) { deps.push(n); }
                    });
                }
                process(deps);
            }
        })(deps);

        if (!exists(moduleName)) {
            context.push(moduleName);
        }

        return context.getDeps();
    },

    /**
     * Find all dependences files of the specified module.
     *
     * @public
     * @param {String} moduleName The module name to process.
     * @return {Array} Returns all of the dependences file list.
     */
    findAllDepsFiles: function(moduleName) {
        var me = this, files = {}, list = [], deps = me.findAllDeps(moduleName), moduleInfo = me.moduleInfo.modules, l = deps.length, file;

        // list the files in FILO
        while (l--) {
            var file = (moduleInfo[deps[l]] || 0).file;
            if (file && !files.hasOwnProperty(file)) {
                files[file] = 1;
                list.push(file);
            }
        }

        // pop the global module to the head;
        var globalModuleName = me.globalModuleName;
        if (globalModuleName) {
            var l = list.length, n;
            while (l--) {
                n = list[l];
                if (n.indexOf(globalModuleName) !== -1) {
                    list.splice(l, 1); list.unshift(n);
                    break;
                }
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
     * Parse page main modules.
     *
     * @return {Object} The page module maps
     * { name: ['abc/modue', 'foo/module'], ... }
     */
    parseMainModules: function() {
        var me = this, pageModules = me._getPageModules(), map = {}, filesRate = {}, totalScore = 0;

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

        globals = array.unique(globals).sort();

        var globalModuleName = me.globalModuleName, corejs = globalModuleName + '.js', index = globals.indexOf(corejs);
        if (index !== -1) {
            // move r.core.js to top
            globals.splice(index, 1);
            globals.unshift(corejs);
        }
        map[globalModuleName] = globals;

        return map;
    },

    combineFiles: function(files, outfile, callback) {
        files = files.concat();

        var basepath = this.basepath, distpath = this.distpath, tmpdir = distpath + '/.tmp';
        var seedfiles = [];

        // compile js
        (function next() {
            var f = files.shift(), distfile;
            if (f) {
                f = path.join(basepath, f); // source file
                distfile = path.join(tmpdir, f); // dist file

                if (!fs.existsSync(f)) {
                    next();
                    console.error('file (' + f + ') not exists. [IGNORED]');
                    return;
                }

                // cache distfile list
                seedfiles.push(distfile);

                if (fs.existsSync(distfile)) {
                    next();
                    return;
                }

                var dir = path.dirname(distfile);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }

                console.log('Compress:', f, '==>', distfile);
                compress.compressjs(f, distfile, function() { next(); });
            }
            else {
                fs.combineSync(seedfiles, outfile);
                if (callback) {
                    callback();
                }
            }
        }());
    },

    combineModules: function(maps) {
        var basepath = this.basepath, distpath = this.distpath;
        var resolvePath = function(name) { return path.join(basepath, name); };
        lang.forEach(maps, function(files, distName) {
            fs.combineSync(files.map(resolvePath), path.join(distpath, distName + '.js'));
        });
    },

    compilerDist: function(callback) {
        var files = fs.find(this.distpath, {type: 'file', extname: '.js'});
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
    },

    /**
     * Returns page module list filter from generic modules `moduleInfo.modules`.
     * Normally referenced by page entry.
     *
     * @private
     * @return {Array} The entry module list.
     */
    _getPageModules: function() {
        var list = this.moduleInfo.modules, filterFn = this.get('pageModuleFilter');
        if (typeof filterFn !== 'function') {
            throw Error('pageModuleFilter not a valid filter function');
        }
        return list.filter(filterFn);
    },

    /**
     * Get the specified module configuration info.
     *
     * @method _getModuleInfo
     * @private
     */
    _getModuleInfo: function(moduleName) {
        moduleName = this.resolveModule(moduleName);
        var conf = this.moduleInfo.modules[moduleName];
        if (!conf) {
            throw Error('module (name="' + moduleName + '") not exists.');
        }
        return conf;
    }
});

// Exports
module.exports = Build;
