var vm = require('vm');
var fs = require('fs');
try {
  var input = JSON.parse(fs.readFileSync(0, 'utf-8'));
  var output = vm.runInNewContext(input.code, input.sandbox);
  fs.writeFileSync(1, JSON.stringify({ output }));
} catch(error) {
  fs.writeFileSync(1, JSON.stringify({ error: error.stack }));
}
