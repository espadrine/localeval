// Thaddée Tyl <thaddee.tyl@gmail.com>. License: CC-BY v3.
"use strict";
(function (root, factory) {
  if (typeof exports === 'object') {
    // CommonJS. node, webpack, browserify, etc...
    module.exports = factory(root);
  } else if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(factory);
  } else {
    // Browser globals (root is window)
    root.localeval = factory(root).localeval;
  }
}(this, function (global) {

// Different implementations for browser and node.js.
var webpack = global.process !== undefined &&
  global.process.browser !== undefined;
var node_js = typeof exports === 'object' && !webpack;

// Primitives for restricting access.
var resetGlobals = function(whitelist) {
  whitelist = new Set(whitelist);
  var obj = this;
  while (obj != null) {
    var globals = Object.getOwnPropertyNames(obj);
    for (var i = 0; i < globals.length; i++) {
      if (!whitelist.has(globals[i])) {
        this[globals[i]] = null;
      }
    }
    obj = Object.getPrototypeOf(obj);
  }
};

if (node_js) {

  var cp = require('child_process');
  var childPath = `${__dirname}/child.js`;
  var child;
  var startChild = function startChild() {
    child = cp.fork(childPath);
  };

  var globalsWhitelist = [
    'Object',             'Function',           'Array',
    'Number',             'parseFloat',         'parseInt',
    'Infinity',           'NaN',                'undefined',
    'Boolean',            'String',             'Symbol',
    'Date',               'Promise',            'RegExp',
    'Error',              'EvalError',          'RangeError',
    'ReferenceError',     'SyntaxError',        'TypeError',
    'URIError',           'JSON',               'Math',
    'Intl',               'ArrayBuffer',        'Uint8Array',
    'Int8Array',          'Uint16Array',        'Int16Array',
    'Uint32Array',        'Int32Array',         'Float32Array',
    'Float64Array',       'Uint8ClampedArray',  'BigUint64Array',
    'BigInt64Array',      'DataView',           'Map',
    'BigInt',             'Set',                'WeakMap',
    'WeakSet',            'Proxy',              'Reflect',
    'decodeURI',          'decodeURIComponent', 'encodeURI',
    'encodeURIComponent', 'escape',             'unescape',
    'isFinite',           'isNaN',              'Buffer',
    'URL',                'URLSearchParams',    'TextEncoder',
    'TextDecoder',        'EventTarget',        'Event',
    'MessageChannel',     'MessagePort',        'MessageEvent',
    'clearInterval',      'clearTimeout',       'setInterval',
    'setTimeout',         'queueMicrotask',     'clearImmediate',
    'setImmediate',       'SharedArrayBuffer',  'Atomics',
    'AggregateError',     'WeakRef',            'global', 'eval',
  ];

  var evaluator = function(code, sandbox, options = {}, cb) {
    if (typeof options === 'number') {
      var timeout = options;
      options = {timeout: timeout};
    } else {
      var timeout = options.timeout;
    }

    // Globals whitelisting for defense in depth.
    code = `(${resetGlobals.toString()})(${JSON.stringify(globalsWhitelist)});\n` + code;

    // Optional parameters: sandbox, timeout, cb.
    var childInput = JSON.stringify({
      code,
      sandbox,
      uid: options.uid,
      gid: options.gid,
    });
    var spawnOptions = {
      timeout,
      env: {},  // Ensure that we don't leak environment variables.
      input: childInput,
    };

    if (cb != null) {
      // We are asynchronous. Spin the background process.
      if (child == null) {
        startChild();
      }
      var childOutput = '';
      child.stdout.on('data', function(data) {
        childOutput += data.toString();
      });
      child.once('close', function(code) {
        if (code !== 0) {
          cb(new Error(`localeval terminated with output ${code}`), code);
        } else {
          try {
            var res = JSON.parse(childOutput);
          } catch(e) {
            res = { error: e };
          }
          cb(res.error, res.output);
        }
        startChild();  // Get a worker ready for a low-latency future eval.
      });
      child.stdin.write(childInput);

    } else {
      // Synchronous execution.
      var childResult =
        cp.spawnSync(process.execPath, [childPath], spawnOptions);
      if (childResult.error) { throw childResult.error; }
      try {
        var res = JSON.parse(childResult.stdout.toString());
      } catch(e) { throw new Error(`Failed localeval execution "${code}"`); }
      if (res.error) { throw res.error; }
      return res.output;
    }
  };

  evaluator.clear = function() {
    if (child) {
      child.kill('SIGKILL');
    }
  };

  return evaluator;

} else {
  // Assume a browser environment.

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
    var ret = f.apply(Object.create(null), builtins.concat(sandbox));
    unalienate();
    return ret;
  };

  var worker;
  var startChild = function startChild() {
    worker = new Worker('worker.js');
  };

  var localeval = function(source, sandbox, options, cb) {
    if (typeof options === 'number') {
      var timeout = options;
      options = {timeout: timeout};
    } else {
      var timeout = options.timeout;
    }
    // Optional parameters: sandbox, timeout, cb.
    if (timeout != null) {
      // We have a timeout. Run in web worker.
      if (worker == null) {
        startChild();
      }
      var th = setTimeout(function() {
        worker.terminate();
        if (cb) {
          cb(new Error('The script took more than ' + timeout + 'ms. Abort.'));
        }
        startChild();
      }, timeout);
      worker.onmessage = function(m) {
        clearTimeout(th);
        if (cb) {
          if (m.data.error) {
            cb(m.data.error);
          } else cb(null, m.data.result);
        }
      };
      worker.postMessage({ code: source, sandbox: sandbox });
    } else {
      // No timeout. Blocking execution.
      return leaklessEval(source, sandbox);
    }
  };

  return {localeval: localeval};

}

}));
