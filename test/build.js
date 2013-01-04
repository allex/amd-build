var Build = require('../build');

var builder = new Build('../../src', 'test/.tmp', {
    aliases: {
        '$': 'vendor/zepto',
        'mustache': 'vendor/mustache'
    }
});
builder.init();
console.log(builder.findAllDepsFiles('conf/index'));
