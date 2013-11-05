// Thaddée Tyl <thaddee.tyl@gmail.com>. License: CC-BY v3.
var node_js = typeof exports === 'object';

(function (root, factory) {
  if (typeof exports === 'object') {
    // Node.
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(factory);
  } else {
    // Browser globals (root is window)
    root.localeval = factory().localeval;
  }
}(this, function () {

// Different implementations for browser and node.js.

if (node_js) {

  var child;
  var startChild = function startChild() {
    var cp = require('child_process');
    child = cp.fork(__dirname + '/child.js');
  };

  return function(code, sandbox, timeout, cb) {
    // Optional parameters: sandbox, timeout, cb.
    if (timeout != null) {
      // We have a timeout. Run in separate process.
      if (child == null) {
        startChild();
      }
      var th = setTimeout(function() {
        child.kill('SIGKILL');
        if (cb) {
          cb(new Error('The script took more than ' + timeout + 'ms. Abort.'));
        }
        startChild();
      }, timeout);
      child.once('message', function(m) {
        clearTimeout(th);
        if (cb) {
          if (m.error) {
            console.log(JSON.stringify(m.error));
            cb(m.error);
          } else cb(null, m.result);
        }
      });
      child.send({ code: code, sandbox: sandbox });

    } else {
      // No timeout. Blocking execution.
      var vm = require('vm');
      return vm.runInNewContext(code, sandbox);
    }
  };

} else {
  // Assume a browser environment.

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

  var worker;
  var startChild = function startChild() {
    worker = new Worker('worker.js');
  };

  function localeval(source, sandbox, timeout, cb) {
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
  }

  return {localeval: localeval};

}

}));
