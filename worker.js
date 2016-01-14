// Thaddée Tyl <thaddee.tyl@gmail.com>. License: CC-BY v3.
onmessage = function(m) {
  try {
    postMessage({
      result: leaklessEval(m.data.code, m.data.sandbox)
    });
  } catch(e) {
    postMessage({
      error: {name: e.name, message: e.message, stack: e.stack}
    });
  }
};

var global = this;

// Do not change what is below without changing localeval.js
//

var reservedWords = [
  "break", "do", "in", "typeof",
  "case", "else", "instanceof", "var",
  "catch", "export", "new", "void",
  "class", "extends", "return", "while",
  "const", "finally", "super", "with",
  "continue", "for", "switch", "yield",
  "debugger", "function", "this",
  "delete", "import", "try",
  "enum", "implements", "package", "protected", "static",
  "interface", "private", "public",
  'eval'
];
var identifier = /^[$_a-zA-Z][$_a-zA-Z0-9]*$/;
var acceptableVariable = function acceptableVariable(v) {
  return (builtinsStr.indexOf(v) === -1) &&
    (reservedWords.indexOf(v) === -1) &&
    (identifier.test(v));
};

// Produce the code to shadow all globals in the environment
// through lexical binding.
// See also var `builtins`.
var builtinsStr = ['JSON', 'Object', 'Function', 'Array', 'String', 'Boolean', 'Number', 'Date', 'RegExp', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError'];
var resetEnv = function() {
  var reset = 'var ';
  if (Object.getOwnPropertyNames) {
    var obj = global;
    var globals;
    while (obj != null) {
      globals = Object.getOwnPropertyNames(obj);
      for (var i = 0; i < globals.length; i++) {
        if (acceptableVariable(globals[i])) {
          reset += globals[i] + ',';
        }
      }
      obj = Object.getPrototypeOf(obj);
    }
  } else {
    for (var sym in global) {
      if (acceptableVariable(sym)) {
        reset += sym + ',';
      }
    }
  }
  reset += 'undefined;';
  return reset;
}

// Given a constructor function, do a deep copy of its prototype
// and return the copy.
var dupProto = function(constructor) {
  if (!constructor.prototype) return;
  var fakeProto = Object.create(null);
  var pnames = Object.getOwnPropertyNames(constructor.prototype);
  for (var i = 0; i < pnames.length; i++) {
    if (pnames[i] !== 'arguments' && pnames[i] !== 'caller') {
      fakeProto[pnames[i]] = constructor.prototype[pnames[i]];
    }
  }
  return fakeProto;
};

var redirectProto = function(constructor, proto) {
  if (!constructor.prototype) return;
  var pnames = Object.getOwnPropertyNames(proto);
  for (var i = 0; i < pnames.length; i++) {
    try {
      constructor.prototype[pnames[i]] = proto[pnames[i]];
    } catch(e) {}
  }
};

var dupProperties = function(obj) {
  var fakeObj = Object.create(null);
  var pnames = Object.getOwnPropertyNames(obj);
  for (var i = 0; i < pnames.length; i++) {
    fakeObj[pnames[i]] = obj[pnames[i]];
    // We cannot deal with cyclic data and reference graphs,
    // so we discard them.
    if (typeof obj[pnames[i]] === 'object') {
      try {
        delete obj[pnames[i]];
      } catch(e) {}
    }
  }
  return fakeObj;
};

var resetProperties = function(obj, fakeObj) {
  var pnames = Object.getOwnPropertyNames(fakeObj);
  for (var i = 0; i < pnames.length; i++) {
    try {
      obj[pnames[i]] = fakeObj[pnames[i]];
    } catch(e) {}
  }
};

var removeAddedProperties = function(obj, fakeObj) {
  if (!fakeObj) return;
  var pnames = Object.getOwnPropertyNames(obj);
  for (var i = 0; i < pnames.length; i++) {
    if (fakeObj[pnames[i]] === undefined) {
      try {
        delete obj[pnames[i]];
      } catch(e) {}
    }
  }
};

// Keep in store all real builtin prototypes to restore them after
// a possible alteration during the evaluation.
var builtins = [JSON, Object, Function, Array, String, Boolean, Number, Date, RegExp, Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError];
var realProtos = new Array(builtins.length);
var realProperties = new Array(builtins.length);

// Fake all builtins' prototypes.
var alienate = function() {
  for (var i = 0; i < builtins.length; i++) {
    realProtos[i] = dupProto(builtins[i]);
    redirectProto(builtins[i], dupProto(builtins[i]));
    realProperties[i] = dupProperties(builtins[i]);
  }
};

// Restore all builtins' prototypes.
var unalienate = function() {
  for (var i = 0; i < builtins.length; i++) {
    removeAddedProperties(builtins[i].prototype, realProtos[i]);
    redirectProto(builtins[i], realProtos[i]);
    removeAddedProperties(builtins[i], realProperties[i]);
    resetProperties(builtins[i], realProperties[i]);
  }
};

// Evaluate code as a String (`source`) without letting global variables get
// used or modified. The `sandbox` is an object containing variables we want
// to pass in.
var leaklessEval = function(source, sandbox) {
  sandbox = sandbox || Object.create(null);
  var sandboxName = '$sandbox$';
  var evalFile = '\n//# sourceURL=sandbox.js\n';
  var sandboxed = 'var ';
  for (var field in sandbox) {
    sandboxed += field + '=' + sandboxName + '["' + field + '"],';
  }
  sandboxed += 'undefined;';
  var params = builtinsStr.concat(sandboxName);
  var sourceStr = JSON.stringify('"use strict";' + source + evalFile);
  var f = Function.apply(null, params.concat(''
        + resetEnv() + sandboxed
        + '\nreturn eval(' + sourceStr + ')'));
  f.displayName = 'sandbox';
  alienate();
  var ret = f.apply(0, builtins.concat(sandbox));
  unalienate();
  return ret;
};
