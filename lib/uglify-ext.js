/**
 * Uglify-js extessions for js compress.
 *
 * @author Allex Wang (allex.wxn@gmail.com)
 */

global.sys = require(/^v0\.[012]/.test(process.version) ? "sys" : "util");

var fs = require("fs");
var uglify = require("uglify-js"), // symlink ~/.node_libraries/uglify-js.js to ../uglify-js.js
    consolidator = uglify.consolidator,
    jsp = uglify.parser,
    pro = uglify.uglify;

// Default options.
var defaultOptions = {
        ast: false,
        consolidate: false,
        mangle: true,
        mangle_toplevel: false,
        no_mangle_functions: false,
        squeeze: true,
        make_seqs: true,
        dead_code: true,
        verbose: false,
        show_copyright: false,
        out_same_file: false,
        max_line_length: 64 * 1024,
        unsafe: false,
        reserved_names: null,
        defines: {
            'DEBUG': ['num', 1]
        },
        lift_vars: false,
        codegen_options: {
                ascii_only: false,
                beautify: false,
                indent_level: 4,
                indent_start: 0,
                quote_keys: false,
                space_colon: false,
                inline_script: false
        },
        make: false,
        output: true            // stdout
};

function output(text, options) {
        var out, filename = options.filename;
        if (options.out_same_file && filename)
                options.output = filename;
        if (options.output === true) {
                out = process.stdout;
        } else {
                out = fs.createWriteStream(options.output, {
                        flags: "w",
                        encoding: "utf8",
                        mode: 0644
                });
        }
        out.write(text.replace(/;*$/, ";"));
        if (options.output !== true) {
                out.end();
        }
};

// --------- main ends here.

function show_copyright(comments) {
        var ret = "";
        for (var i = 0; i < comments.length; ++i) {
            var c = comments[i];
            if (c.type == "comment1") {
                // Strip multi comments typs. /* ... */// ....
                if (i === 0 || c[i - 1] === 'comment1') {
                    ret += "//" + c.value + "\n";
                }
            } else {
                ret += "/*" + c.value + "*/";
            }
        }
        return ret;
};

function squeeze_it(code, options) {
    var result = "";

    if (options.show_copyright) {
        var tok = jsp.tokenizer(code), c;
        c = tok();
        result += show_copyright(c.comments_before);
    }
    try {
        var ast = time_it("parse", function(){ return jsp.parse(code); });
        if (options.consolidate) ast = time_it("consolidate", function(){
            return consolidator.ast_consolidate(ast);
        });
        if (options.lift_vars) {
            ast = time_it("lift", function(){ return pro.ast_lift_variables(ast); });
        }
        ast = time_it("mangle", function(){
            return pro.ast_mangle(ast, {
                   mangle       : options.mangle,
                   toplevel     : options.mangle_toplevel,
                   defines      : options.defines,
                   except       : options.reserved_names,
                   no_functions : options.no_mangle_functions
            });
        });
        if (options.squeeze) ast = time_it("squeeze", function(){
            ast = pro.ast_squeeze(ast, {
                make_seqs  : options.make_seqs,
                dead_code  : options.dead_code,
                keep_comps : !options.unsafe,
                unsafe     : options.unsafe
            });
            if (options.unsafe)
            ast = pro.ast_squeeze_more(ast);
        return ast;
        });
        if (options.ast)
            return sys.inspect(ast, null, null);
        result += time_it("generate", function(){ return pro.gen_code(ast, options.codegen_options) });
        if (!options.codegen_options.beautify && options.max_line_length) {
            result = time_it("split", function(){ return pro.split_lines(result, options.max_line_length) });
        }
        return result;
    } catch(ex) {
        sys.debug(ex.stack);
        sys.debug(sys.inspect(ex));
        sys.debug(JSON.stringify(ex));
        process.exit(1);
    }

    function time_it(name, cont) {
            if (!options.verbose)
                    return cont();
            var t1 = new Date().getTime();
            try { return cont(); }
            finally { sys.debug("// " + name + ": " + ((new Date().getTime() - t1) / 1000).toFixed(3) + " sec."); }
    }
};

function mix(o, s, depth) {
    var args = [].slice.call(arguments, 1), l = args.length;
    for (var i = -1, t, k; i < l; ) {
        t = args[++i];
        for (k in t) if (t.hasOwnProperty(k)) {
            if (t[k] && o[k] && typeof t[k] === 'object') {
                mix(o[k], t[k]);
            } else {
                o[k] = t[k];
            }
        }
    }
    return o;
};

function merge(r, s) {
    var o = {}, args = [].slice.call(arguments, 0), l = args.length;
    for (var i = -1, t, k; i < l; ) {
        t = args[++i];
        for (k in t) if (t.hasOwnProperty(k)) {
            if (t[k] && o[k] && typeof t[k] === 'object') {
                mix(o[k], t[k]);
            } else {
                o[k] = t[k];
            }
        }
    }
    return o;
};

exports.squeeze = function(s, opts) {
    return squeeze_it(s, merge(defaultOptions, opts));
};
