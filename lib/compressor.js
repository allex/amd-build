/**
 * JS, CSS compress utilities functions.
 * Provide third-party compress methods, uglifyjs, closure, csscompress
 *
 * @author Allex Wang (allex.wxn@gmail.com)
 */
var fs = require('fs')
  , exec = require('child_process').exec
  , uglify_js = require('./uglify-ext')
  , htmlMinifier = require('html-minifier')
;

/**
 * @private
 */
function output(text, filename) {
    var out = fs.createWriteStream(filename, {
        flags: "w",
        encoding: "utf8",
        mode: 0644
    });
    out.write(text.replace(/;*$/, ";"));
    out.end();
}

/**
 * Compiler js by google-closure.jar.
 *
 * @method closure
 * @public
 * @param {String} infile The js filepath of js source codes string.
 */
function closure(infile, outfile, callback) {
    var cmd = 'closure', stdin = false, source;

    // filename
    if (infile.indexOf('\n') === -1 && fs.existsSync(infile)) {
        cmd += ' ' + infile
    }
    // js source code
    else {
        stdin = true;
        source = infile;
    }

    if (typeof outfile === 'function') {
        callback = outfile;
    }
    else {
        cmd += ' --js_output_file ' + outfile;
    }

    var child = exec(cmd, {maxBuffer: 10000 * 1024}, function(err, stdout, stderr) {
        err = err || stderr;
        callback && callback(err, stdout, stderr);
    });

    if (stdin) {
        child.stdin.write(source);
        child.stdin.end();
    }
}

/**
 * compress js source code by uglifyjs squeeze.
 *
 * @public
 * @param {String} text The js source code.
 * @return {String} The compressed js codes.
 */
function uglifyjs_squeeze(text) {
    var output = uglify_js.squeeze(text, {
        lift_vars: true,
        unsafe: true,
        max_line_length: 0,
        defines: {
            'DEBUG': ['num', 0]
        },
        codegen_options: {
            ascii_only: true
        }
    });
    return output;
}

// uglifyjs parser
function uglifyjs(filename, outfile, callback) {
    // out to same file if not passed by the defaults.
    if (typeof outfile === 'function') {
        callback = outfile;
        outfile = filename;
    }
    fs.readFile(filename, "utf8", function(err, text) {
        if (err) throw err;
        var result = uglifyjs_squeeze(text);
        output(result, outfile);
        if (callback) {
            callback(err, result, null);
        }
    });
}

function compressjs(infile, outfile, callback) {
    closure(infile, outfile, function(err, stdout, stderr) {
        uglifyjs(outfile, callback);
    });
}

// cssstylecheck compress.
function compresscss(infile, outfile, callback) {
    exec('csscompress --output ' + outfile + ' ' + infile, function(err, stdout, stderr) {
        err = err || stderr;
        callback(err, stdout, stderr);
    });
}

function yuicompressor(infile, outfile, callback, options) {
    var command = 'java -jar -Xss2048k "' + __dirname + '/yuicompressor-2.4.8.jar" "' + infile + '"';
    if (outfile) {
        command += ' -o "' + outfile + '"';
    }
    if (options) {
        command += ' ' + options.join(' ');
    }
    exec(command, function(err, stdout, stderr) {
        err = err || stderr;
        callback(err, stdout, stderr);
    });
}

function htmlminify(html, options) {
    return htmlMinifier.minify(html, options);
}

// Exports
exports.closure = closure;
exports.uglifyjs = uglifyjs;
exports.uglifyjs_squeeze = uglifyjs_squeeze;

exports.compressjs = compressjs;
exports.compresscss = compresscss;
exports.yuicompressor = yuicompressor;

exports.htmlminify = function(html) {
    var options = {
        removeComments:                 true,
        removeCommentsFromCDATA:        true,
        removeCDATASectionsFromCDATA:   true,
        collapseWhitespace:             true,
        collapseBooleanAttributes:      true,
        removeAttributeQuotes:          false,
        removeRedundantAttributes:      true,
        useShortDoctype:                true,
        removeEmptyAttributes:          true,
        removeEmptyElements:            false,
        removeOptionalTags:             false,
        removeScriptTypeAttributes:     false,
        removeStyleLinkTypeAttributes:  true,
        compressJs:                     true
    };
    return htmlminify(html, options);
};
