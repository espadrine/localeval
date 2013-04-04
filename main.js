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
    root.returnExports = factory();
  }
}(this, function () {

if (node_js) {

  var vm = require('vm');
  return vm.runInNewContext;

} else {
  // Assume a browser environment.

  function resetEnv(global) {
    var reset = 'var ';
    if (Object.getOwnPropertyNames) {
      var obj = this;
      var globals;
      while (obj !== null) {
        globals = Object.getOwnPropertyNames(obj);
        for (var i = 0; i < globals.length; i++) {
          reset += globals[i] + ',';
        }
        obj = Object.getPrototypeOf(obj);
      }
    } else {
      for (var sym in this) {
        reset += globals[i] + ',';
      }
    }
    reset += 'undefined;';
    return reset;
  }

  // Evaluate code as a String (`source`) without letting global variables get
  // used or modified. The `sandbox` is an object containing variables we want to
  // pass in.
  function leaklessEval(source, sandbox, sandboxName) {
    sandbox = sandbox || Object.create(null);
    sandboxName = sandboxName || '$sandbox$';
    var sandboxed = 'var ';
    for (var field in sandbox) {
      sandboxed += field + ' = ' + sandboxName + '["' + field + '"],';
    }
    sandboxed += 'undefined;';
    var ret = Function(sandboxName, resetEnv() + sandboxed + source)
      .bind(Object.create(null))(sandbox);
    return ret;
  }

  return {localeval: leaklessEval};

}

}));
