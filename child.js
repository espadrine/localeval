var vm = require('vm');

process.on('message', function(m) {
  try {
    process.send({
      result: vm.runInNewContext(m.code, m.sandbox)
    });
  } catch(e) {
    process.send({
      error: {name: e.name, message: e.message, stack: e.stack}
    });
  }
});
