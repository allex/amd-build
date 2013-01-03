/**
 * JS, CSS compress utilities functions.
 * Provide third-party compress methods, uglifyjs, closure, csscompress
 *
 * @author Allex (allex.wxn@gmail.com)
 */
var fs = require('fs')
  , uglify = require('uglify-js')
  , exec = require('child_process').exec
;

// closure compiler
function closure(infile, outfile, callback) {
    var cmd = 'closure', stdin = false;

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

// uglifyjs parser
function uglifyjs(file, callback) {
    exec('uglifyjs --overwrite ' + file, function(err, stdout, stderr) {
        if (err) console.error('uglifyjs:', stderr);
        callback && callback(err, stdout, stderr);
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

