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


// Do not change what is below without changing localeval.js
//

// Produce the code to shadow all globals in the environment
// through lexical binding.
// See also var `builtins`.
var builtinsStr = ['eval', 'Object', 'Function', 'Array', 'String', 'Boolean', 'Number', 'Date', 'RegExp', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError'];
function resetEnv(global) {
  var reset = 'var ';
  if (Object.getOwnPropertyNames) {
    var obj = this;
    var globals;
    while (obj !== null) {
      globals = Object.getOwnPropertyNames(obj);
      for (var i = 0; i < globals.length; i++) {
        if (builtinsStr.indexOf(globals[i]) === -1) {
          reset += globals[i] + ',';
        }
      }
      obj = Object.getPrototypeOf(obj);
    }
  } else {
    for (var sym in this) {
      reset += sym + ',';
    }
  }
  reset += 'undefined;';
  return reset;
}

// Given a constructor function, do a deep copy of its prototype
// and return the copy.
function dupProto(constructor) {
  if (!constructor.prototype) return;
  var fakeProto = Object.create(null);
  var pnames = Object.getOwnPropertyNames(constructor.prototype);
  for (var i = 0; i < pnames.length; i++) {
    fakeProto[pnames[i]] = constructor.prototype[pnames[i]];
  }
  return fakeProto;
}

function redirectProto(constructor, proto) {
  if (!constructor.prototype) return;
  var pnames = Object.getOwnPropertyNames(proto);
  for (var i = 0; i < pnames.length; i++) {
    constructor.prototype[pnames[i]] = proto[pnames[i]];
  }
}

// Keep in store all real builtin prototypes to restore them after
// a possible alteration during the evaluation.
var builtins = [eval, Object, Function, Array, String, Boolean, Number, Date, RegExp, Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError];
var realProtos = new Array(builtins.length);
for (var i = 0; i < builtins.length; i++) {
  realProtos[i] = dupProto(builtins[i]);
}

// Fake all builtins' prototypes.
function alienate() {
  for (var i = 0; i < builtins.length; i++) {
    redirectProto(builtins[i], dupProto(builtins[i]));
  }
}

// Restore all builtins' prototypes.
function unalienate() {
  for (var i = 0; i < builtins.length; i++) {
    redirectProto(builtins[i], realProtos[i]);
  }
}

// Evaluate code as a String (`source`) without letting global variables get
// used or modified. The `sandbox` is an object containing variables we want
// to pass in.
function leaklessEval(source, sandbox) {
  sandbox = sandbox || Object.create(null);
  var sandboxName = '$sandbox$';
  var evalFile = '\n//# sourceURL=sandbox.js\n';
  var sandboxed = 'var ';
  for (var field in sandbox) {
    sandboxed += field + '=' + sandboxName + '["' + field + '"],';
  }
  sandboxed += 'undefined;';
  alienate();
  var params = builtinsStr.concat(sandboxName);
  var f = Function.apply(null, params.concat(resetEnv() + sandboxed
        + '\nreturn eval(' + JSON.stringify(source + evalFile) + ')'));
  f.displayName = 'sandbox';
  var ret = f.apply(null, builtins.concat(sandbox));
  unalienate();
  return ret;
}
