# Local Eval

Evaluate a string of JS code without access to the global object.

In Node.js, always use that instead of `eval()`. Always.

API:

    localeval(code :: String, sandbox :: Object) :: Object.

    localeval(code :: String,    sandbox :: Object,
              timeout :: Number, cb :: Function)

The `code` is a string of JS code. The `sandbox` contains objects which are
going to be accessible in the JS code.
It returns the last evaluated piece of JS code in `code`, if no timeout is
given. Otherwise, after at most `timeout` milliseconds, the callback gives that
result as a parameter: `function(error, result) {…}`.

Node example:

```javascript
var localeval = require('localeval');
localeval('console.log("Do I have access to the console?")');  // Throws.
localeval.clear();  // Kills processes used internally.
```

Browser example (experimental):

```html
<!doctype html><title></title>
<script src='localeval.js'></script>
<!-- Alerts "32". -->
<script> alert(localeval('a + b', {a: 14, b: 18})) </script>
```

You may find an example of use in browser code in `main.html`.

# Purpose

Offering a process-separated timeout-ed VM for Node.js.

Trying to find a reasonable cross-environment ES5 sandbox evaluation function.
Note that the browser part is experimental.

# Warning

If no timeout is given, it doesn't protect your single-threaded code against
infinite loops.

In the browser, the following leak:

- `({}).constructor.getOwnPropertyNames = function(){return 'leak';}`
- `Function("this.foo = 'leak'")()`

If a timeout is given, an attacker can still use XHR:

- `Function("this.XMLHttpRequest(…); …")()`

That said, it strives to achieve the following:

1. All local and global variables are inaccessible.

2. Variables defined while evaluating code don't pollute any scope.

3. Evaluated code cannot fiddle with global object's properties.
   Think
   `localeval('([]).__proto__.push = function(a) { return "nope"; }')`.

# Things to try

In comments are what should be executed outside the sandbox.

```js
String.prototype.slice = function() { return 'leaked'; };
// 'nice'.slice(1) === 'ice'
String.fromCharCode = function() { return 'leaked'; };
// String.fromCharCode(42) === '*'
// var foo = 1
foo = 7
this.foo = 7
window.foo = 7
eval('foo = 7')
// foo === 1
delete Number.parseInt
// Number.parseInt('1337') === 1337
String.prototype.leak = function() { return 'leak'; }
// try { ''.leak() } catch(e) { /not a function/.test(e.message) }
```

---

This work is licensed under the Creative Commons Attribution 3.0 Unported
License. To view a copy of this license, visit
<http://creativecommons.org/licenses/by/3.0/>.
