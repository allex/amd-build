var fs = require('fs'),
    uglify = require('uglify-js'),
    pro = uglify.uglify,
    jsp = uglify.parser,

    gen_code = pro.gen_code
;

/**
 * AMD module entity constructor, provide generate source code by AST.
 */
function AmdModule(name, deps, ast) {
    this.name = name;
    this.deps = [];
    this.ast = ast;
}
AmdModule.prototype.addDeps = function(requires) {
    var deps = this.deps;
    if (typeof requires === 'string') {
        requires = [requires];
    }
    requires.length > 0 && requires.forEach(function(n) {
        if (deps.indexOf(n) === -1) {
            deps.push(n);
        }
    });
};
AmdModule.prototype.toSource = function() {
    var ast = this.ast;
    return ast ? gen_code(ast) : '';
};

// Helper functions

function getAst(source, charset) {
    if (typeof source !== 'string') {
        return source;
    }

    if (source.indexOf('\n') === -1 && fs.existsSync(source)) {
        source = fs.readFileSync(source, charset || 'utf8');
    }

    return jsp.parse(source);
}

function walkAst(ast, type, walker) {
    var w = pro.ast_walker();

    var walkers = {};
    walkers[type] = function() {
        walker(this);
    };

    return w.with_walkers(walkers, function() {
        return w.walk(ast);
    });
}

function parseStatic(inputFile, charset) {
    var ast = getAst(inputFile, charset);
    var deps, times = 0;

    walkAst(ast, 'stat', function(stat) {
        if (stat.toString().indexOf('stat,call,name,define,') !== 0) {
            return stat;
        }

        // only process the first one.
        if (++times > 1) {
            return;
        }

        // stat[1]:
        //     [ 'call',
        //       [ 'name', 'define' ],
        //       [ [Object], [Object], [Object ] ] ]
        var argsAst = stat[1][2];
        var depsAst;

        // argsAst:
        //   [ [ 'string', 'a' ],
        //     [ 'array', [ [Object], [Object] ] ],
        //     [ 'function', null, [], [] ] ]
        argsAst.some(function(item, i) {
            // NOTICE: the deps MUST be literal, it can NOT be a reference.
            if (item[0] === 'array' && i !== argsAst.length - 1) {
                depsAst = item[1];
                return true;
            }
        });

        if (!depsAst) {
            return stat;
        }

        // depsAst:
        //   [ [ 'string', 'b' ], [ 'string', 'c' ] ]
        deps = [];
        depsAst.forEach(function(item) {
            if (item[0] === 'string') {
                deps.push(item[1]);
            }
        });

        return stat;
    });

    return deps;
}

function parseDynamic(inputFile, charset) {
    var ast = getAst(inputFile, charset);
    var deps = [];

    walkAst(ast, 'call', function(stat) {
        if (stat.toString().indexOf('call,name,require,') !== 0) {
            return stat;
        }

        // stat:
        //   [ 'call', [ 'name', 'require' ], [ [ 'string', 'a' ] ] ]
        var argsAst = stat[2];

        argsAst.forEach(function(item) {
            if (item[0] === 'string') {
                deps.push(item[1]);
            }
        });

        return stat;
    });

    return deps;
}

/**
 * Parse bundle file for multi AMD modules.
 */
function parseFile(inputFile, charset) {
    var ast = getAst(inputFile, charset);
    var moduleList = {};

    walkAst(ast, 'stat', function(stat) {
        if (stat.toString().indexOf('stat,call,name,define,') !== 0) {
            return stat;
        }

        // stat[1]:
        //     [ 'call',
        //       [ 'name', 'define' ],
        //       [ [Object], [Object], [Object ] ] ]
        var argsAst = stat[1][2];
        var moduleName, depsAst;

        argsAst.some(function(item, i) {
            // NOTICE: the deps MUST be literal, it can NOT be a reference.
            if (item[0] === 'string' && i === 0) {
                moduleName = item[1];
                return true;
            }
        });

        // TODO: get moduleName by inputFile path additionally.
        if (!moduleName) return stat;

        var module = moduleList[moduleName] || (moduleList[moduleName] = new AmdModule(moduleName, [], stat));

        // argsAst:
        //   [ [ 'string', 'a' ],
        //     [ 'array', [ [Object], [Object] ] ],
        //     [ 'function', null, [], [] ] ]
        argsAst.some(function(item, i) {
            // NOTICE: the deps MUST be literal, it can NOT be a reference.
            if (item[0] === 'array' && i !== argsAst.length - 1) {
                depsAst = item[1];
                return true;
            }
        });

        if (!depsAst) {
            return stat;
        }

        // depsAst:
        //   [ [ 'string', 'b' ], [ 'string', 'c' ] ]
        var deps = moduleList[moduleName] || [];
        depsAst.forEach(function(item) {
            if (item[0] === 'string') {
                module.deps.push(item[1]);
            }
        });

        return stat;
    });

    return moduleList;
}

function parse(inputFile, charset) {
    var ast = getAst(inputFile, charset);
    var deps = parseStatic(ast);
    if (deps === undefined) {
        deps = parseDynamic(ast);
    }
    return deps;
}

// Exports
exports.getAst = getAst;

// amd module parse helper functions
exports.parse = parse;
exports.parseFile = parseFile;
exports._parseStatic = parseStatic;
exports._parseDynamic = parseDynamic;

