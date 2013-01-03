/**
 * AMD project dependences builder
 *
 * @author Allex Wang (allex.wxn@gmail.com)
 */

var fs = require('fs-ext'),
    path = require('path'),
    util = require('./util'),
    AMDParser = require('./parser');

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
    this.reserveModules = ['global', 'require', 'exports', 'module'];

    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir);
    }
    this.moduleInfo = {};
}

util.mixin(Build.prototype, {
    init: function() {
        this.moduleInfo = (new AMDParser(this.srcDir, this.distDir + '/cache.json')).parse();
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
    }
});

// Exports
module.exports = Build;
