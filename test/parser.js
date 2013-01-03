var Parser = require('../parser');

var p = new Parser('../../src', 'test/.tmp/cache.json');
var rs = p.parse();
console.log(rs);
