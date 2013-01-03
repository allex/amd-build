var fs = require('fs');
var amdutil = require('../amdutil');

// Test
var argv = require('optimist').argv;
var f = argv.file || argv['_'][0];

if (!fs.existsSync(f)) {
    console.log('file not exist.');
    process.exit();
}

// parse amd module file
var modules = amdutil.parseFile(f);
for (var k in modules) {
    console.log(modules[k].toSource());
}
