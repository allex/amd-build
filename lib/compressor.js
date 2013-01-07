/**
 * JS, CSS compress utilities functions.
 * Provide third-party compress methods, uglifyjs, closure, csscompress
 *
 * @author Allex Wang (allex.wxn@gmail.com)
 */
var fs = require('fs')
  , exec = require('child_process').exec
  , uglify_js = require('./uglify-ext')
;

// closure compiler
function closure(infile, outfile, callback) {
    var cmd = 'closure', stdin = false, source;

    if (infile.indexOf('\n') === -1 && fs.existsSync(infile)) {
        cmd += ' ' + infile
    } else {
        stdin = true;
        source = infile;
    }
    if (typeof outfile === 'function') {
        callback = outfile;
    } else {
        cmd += ' --js_output_file ' + outfile;
    }

    var child = exec(cmd, {maxBuffer: 10000 * 1024}, function(err, stdout, stderr) {
        callback && callback(stdout);
        if (err) console.error('compiler:', stderr);
    });

    if (stdin) {
        child.stdin.write(source);
        child.stdin.end();
    }
}

function output(text, filename) {
    var out = fs.createWriteStream(filename, {
        flags: "w",
        encoding: "utf8",
        mode: 0644
    });
    out.write(text.replace(/;*$/, ";"));
    out.end();
}

function uglifyjs_squeeze_it(text) {
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

    // default out to same file
    if (typeof outfile === 'function') {
        callback = outfile;
        outfile = filename;
    }

    fs.readFile(filename, "utf8", function(err, text) {
        if (err) throw err;
        var result = uglifyjs_squeeze_it(text);
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
        if (err) console.error('csscompress:', stderr);
        callback(err, stdout, stderr);
    });
}

// Exports
exports.closure = closure;
exports.uglifyjs = uglifyjs;

exports.compressjs = compressjs;
exports.compresscss = compresscss;

