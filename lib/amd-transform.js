/**
 * Normalize CommonJS module dependencies syntax to AMD.
 *
 * @author Allex Wang (allex.wxn@gmail.com)
 */

var through = require('through')
  , esprima = require('esprima')
  , estraverse = require('estraverse')
  , escodegen = require('escodegen')
  ;


/**
 * Transform CommonJS requires to AMD dependencies.
 *
 * @param {Object} options (Optional) set the options of the transform.
 *
 * @return {Stream}
 */
module.exports = function(options) {
  var data = '';

  var stream = through(write, end);
  return stream;

  function write(buf) { data += buf }
  function end() {
    var ast = esprima.parse(data)
      , tast
      , isAMD = false;

    estraverse.replace(ast, {
      enter: function(node) {
        if (isDefine(node)) {
          var parents = this.parents();

          // Check that this module is an AMD module, as evidenced by invoking
          // `define` at the top-level.  Any CommonJS or UMD modules are pass
          // through unmodified.
          if (parents.length == 2 && parents[0].type == 'Program' && parents[1].type == 'ExpressionStatement') {
            isAMD = true;
          }
        }
      },
      leave: function(node) {
        if (isDefine(node)) {
          if (node.arguments.length === 1 &&
              node.arguments[0].type === 'FunctionExpression') {

            // define(function (...) {});

            var factory = node.arguments[0]
              , deps = []
              , vars = factory.params.map(function(el) { return el.name });

            var innerRequires = findRequireDepNames(factory.body);
            if (innerRequires.length > 0) {
              var funcArgLength = vars.length;
              if (funcArgLength > 0) {
                var reverseIds = funcArgLength === 1 ? ['require'] : ['require', 'exports', 'module'];
                reverseIds.forEach(function(k, i) {
                  if (!deps[i]) { deps[i] = k; }
                  if (!vars[i]) { vars[i] = k; }
                });
              }
              innerRequires.forEach(function(id) {
                if (deps.indexOf(id) === -1) { deps.push(id); }
              });
            }

            var i = 0;
            if (deps.length) {
                node.arguments[i++] = createAmdRequires(deps);
            }
            node.arguments[i++] = factory;
            factory.params = createFunctionParams(vars);

            return node;
          }
          else if (node.arguments.length === 2 &&
                   node.arguments[0].type === 'ArrayExpression' &&
                   node.arguments[1].type === 'FunctionExpression') {

            // define([...], function (...) {});

            var dependencies = node.arguments[0]
              , factory = node.arguments[1];

            var deps = dependencies.elements.map(function(el) { return el.value });
            var vars = factory.params.map(function(el) { return el.name });

            var innerRequires = findRequireDepNames(factory.body);
            if (innerRequires.length > 0) {
              if (deps.indexOf('require') === -1) {
                deps.unshift('require');
                vars.unshift('require');
              }
              innerRequires.forEach(function(id) {
                if (deps.indexOf(id) === -1) { deps.push(id); }
              });
            }

            node.arguments[0] = createAmdRequires(deps);
            node.arguments[1].params = createFunctionParams(vars);

            return node;
          }
          else if (node.arguments.length === 3 &&
                   node.arguments[0].type === 'Literal' &&
                   node.arguments[1].type === 'ArrayExpression' &&
                   node.arguments[2].type === 'FunctionExpression') {

            // define('<id>', [...], function (...) {});

            var id = node.arguments[0]
              , dependencies = node.arguments[1]
              , factory = node.arguments[2];

            var deps = dependencies.elements.map(function(el) { return el.value });
            var vars = factory.params.map(function(el) { return el.name });

            var innerRequires = findRequireDepNames(factory.body);
            if (innerRequires.length > 0) {
              if (deps.indexOf('require') === -1) {
                deps.unshift('require');
                vars.unshift('require');
              }
              innerRequires.forEach(function(id) {
                if (deps.indexOf(id) === -1) { deps.push(id); }
              });
            }

            node.arguments[1] = createAmdRequires(deps);
            node.arguments[2].params = createFunctionParams(vars);

            return node;
          }
        }
      }
    });

    if (!isAMD) {
      stream.queue(data);
      stream.queue(null);
      return;
    }

    var out = escodegen.generate(ast, {
        format: {
            compact: true
        }
    });
    stream.queue(out);
    stream.queue(null);
  }
};

function isDefine(node) {
  var callee = node.callee;
  return callee
    && node.type == 'CallExpression'
    && callee.type == 'Identifier'
    && callee.name == 'define'
  ;
}

function isRequire(node) {
  return node && node.type === 'CallExpression' && node.callee &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'require' &&
    node.arguments && node.arguments.length === 1
  ;
}

// Returns the commonjs requires dictionary
// ==>
//  [
//   [id, var],
//   [id, var],
//   ...
//  ]
function processRequireDepVars(node, requires) {
  if (!requires) {
    requires = [];
  }
  estraverse.replace(node, {
    enter: function(node) {
      var type = node.type, arg, vname;
      if (type === 'VariableDeclarator' && isRequire(node.init)) {
        arg = node.init.arguments[0];
        if (arg.type === 'Literal') {
          if (node.id && node.id.type === 'Identifier') {
            vname = node.id.name;
          }
          requires.push([arg.value, vname]);
          this.skip();
        }
      }
      else if (type === 'AssignmentExpression' && node.operator === '=' && isRequire(node.right)) {
        arg = node.right.arguments[0];
        if (arg.type === 'Literal') {
          if (node.left && node.left.type === 'Identifier') {
            vname = node.left.name;
          }
          requires.push([arg.value, vname]);
          this.skip();
        }
      }
      else if (isRequire(node)) {
          requires.push([node.arguments[0].value, '__NULL__']);
      }
    }
  });
  return requires;
}

function findRequireDepNames(node) {
  var deps = [];
  estraverse.traverse(node, {
    enter: function(node) {
      if (isRequire(node)) {
        arg = node.arguments[0];
        if (arg.type === 'Literal') {
          deps.push(arg.value);
        }
      }
    }
  });
  return deps;
}

function isReturn(node) {
  return node.type == 'ReturnStatement';
}

function createProgram(body) {
  return { type: 'Program', body: body };
}

function createCjsRequires(ids, vars) {
  var decls = [];
  
  for (var i = 0, len = ids.length; i < len; ++i) {
    if (['require', 'module', 'exports'].indexOf(ids[i]) != -1) { continue; }
    
    decls.push({ type: 'VariableDeclarator',
      id: { type: 'Identifier', name: vars[i] },
      init: 
        { type: 'CallExpression',
          callee: { type: 'Identifier', name: 'require' },
          arguments: [ { type: 'Literal', value: ids[i] } ] } });
  }
  
  if (decls.length == 0) { return null; }
  
  return { type: 'VariableDeclaration',
    declarations: decls,
    kind: 'var' };
}

function createAmdRequires(deps) {
  var arr = [];
  for (var i = 0, len = deps.length; i < len; ++i) {
    arr[i] = { "type": "Literal", "value": deps[i], "raw": "'" + deps[i] + "'" };
  }
  return { "type": "ArrayExpression", "elements": arr };
}

function createFunctionParams(params) {
  return params.map(function(k) {
    return {"type": "Identifier", "name": k};
  });
}

function createModuleExport(obj) {
  return { type: 'ExpressionStatement',
    expression: 
     { type: 'AssignmentExpression',
       operator: '=',
       left: 
        { type: 'MemberExpression',
          computed: false,
          object: { type: 'Identifier', name: 'module' },
          property: { type: 'Identifier', name: 'exports' } },
       right: obj } };
}
