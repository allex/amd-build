/**
 * JS, CSS compress utilities functions.
 * Provide third-party compress methods, uglifyjs, closure, csscompress
 *
 * @author Allex Wang (allex.wxn@gmail.com)
 */
var fs = require('fs-x')
  , crypto = require('crypto')
  , exec = require('child_process').exec
  , UglifyJS = require('uglify-js')
  , htmlMinifier = require('html-compressor')
;

/**
 * @private
 */
function output(data, filename) {
    fs.writeFileSync(filename, data, {flags: 'w', encoding: 'utf8', mode: 0644});
}

function sha1(data) {
    return crypto.createHash('sha1').update(data + '').digest('hex');
}

// Helper function for creates tmpfile with optional contents.
function tmpfile(content) {
    content = content || '';
    var f = './' + sha1(Math.random()) + '.tmp';
    output(content, f);
    return f;
}

function combineArgs(options) {
    var s = '';
    for (var k in options) {
        if (options.hasOwnProperty(k) && k.charAt(0) === '-') {
            s += ' ' + k + '=' + options[k];
        }
    }
    return s;
}

// evaluates debug statement codes.
function evalDebugInfo(f) {
    var s = fs.readFileSync(f, {encoding: 'utf8'});
    s = s.replace(/[\r\n]+\s*\/\/\s?<debug>[\s\S]*?<\/debug>/g, '');
    output(s, f);
}

function is_file(f, exits) {
    if (typeof f === 'string' && !~f.indexOf('\n')) {
        return exits ? fs.existsSync(f) : true;
    }
    return false;
}

/**
 * Compiler js by google-closure.jar.
 *
 * @method closure
 * @public
 * @param {Array|String} target The js filepath of js source codes string or file list.
 * @param {Object|string} options The output file path or closure options object.
 * @param {Function} callback (Optional) call the function when commond executed.
 */
function closure(target, options, callback) {

    // By Allex Wang (http://iallex.com),  Licensed under the MIT license.

    var fileIn, fileOut, tmp;

    // string or file path
    if (typeof target === 'string') {

        // stdin mode, create tmpfile first.
        if (!is_file(target, true)) {
            tmp = tmpfile(target);
        } else {
            tmp = tmpfile(fs.readFileSync(target));
        }
    }
    else {
        // combine file list.
        if (Array.isArray(target)) {
            fs.combineSync(target, tmp = tmpfile());
        }
    }

    fileIn = tmp;

    if (options) {
        switch (typeof options) {
        case 'object':
            fileOut = options.out;
            break;
        case 'string':
            fileOut = options;
            options = {};
            break;
        case 'function':
            callback = options;
            options = {};
        }
    }

    if (!fileIn || (!fileOut && !callback)) {
        console.error('compiling failed, Illegal argument. [ignoring]');
        callback && callback();
        return;
    }

    if (fileOut) {
        options['--js_output_file'] = '"' + fileOut + '"';
    }

    if (options.debug !== true) { // Default to compile debug statements
        evalDebugInfo(fileIn);
    }

    options['--js'] = fileIn;
    options['--charset'] = 'UTF-8';
    options['--language_in'] = options['--language_in'] || 'ECMASCRIPT5_STRICT';

    var cmd = 'java -server -XX:+TieredCompilation -jar -Xss2048k "' + __dirname + '/compiler.jar"' + combineArgs(options);
    var child = exec(cmd, {maxBuffer: 1000 * 1024}, function(err, stdout, stderr) {
        err = err || stderr;
        callback && callback(err, stdout, stderr);
        if (tmp) try {
            fs.rm(tmp);
        } catch (e) { console.error('cleanup tmp file failed.', e); }
    });

    return child;
}

// uglifyjs parser
function uglifyjs(filename, outfile, callback) {
    // out to same file if not passed by the defaults.
    if (typeof outfile === 'function') {
        callback = outfile;
        outfile = filename;
    }

    callback = callback || function(error) {
        if (error) {
            console.log('UglifyJS error: ' + error.message);
        }
    };

    if (typeof filename === 'string') {

        var result;

        // For more options see https://github.com/mishoo/UglifyJS2
        try {
            var source = filename;
            if (is_file(source, true)) {
                result = UglifyJS.minify(filename).code;
            } else {
                result = UglifyJS.minify(filename, {fromString: true}).code;
            }
            if (outfile) {
                output(result, outfile);
            }
            callback(null, result, null);
        }
        catch (e) {
            callback(e, result, null);
        }
    }
    else {
        callback({message: 'Illegal arguments, input not valid!'}, null, null);
    }
}

function compressjs(infile, outfile, callback) {
    closure(infile, outfile, function(err, stdout, stderr) {
        uglifyjs(outfile, callback);
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

exports.compressjs = compressjs;
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
