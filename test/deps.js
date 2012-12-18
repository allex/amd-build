var fs = require('fs');
var amdutil = require('../amdutil');

// Test
var argv = require('optimist').argv;
var f = argv.f;

if (!fs.existsSync(f)) {
    console.log('file not exist.');
    process.exit();
}

var modules = amdutil.parseFile(f);
for (var k in modules) {
    console.log(modules[k].toSource());
}
