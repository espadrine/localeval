# Local Eval

Evaluate a string of JS code without access to the global object.

In Node.js, always use that instead of `eval()`. Always.

In the browser, do not expect it to be able to safely execute untrusted code
yet.

API:

    localeval(code :: String, sandbox :: Object) :: Object.

    localeval(code :: String, sandbox :: Object,
              options :: Object, cb :: Function)

- `code`: string of JS code.
- `sandbox`: object whose values will be in the global object in the sandbox.
- `options`: object containing the following optional fields:
  - `timeout`: number of milliseconds that the child process has to run the
     code, beyond which it will be killed.
  - `uid`: user id under which the child process must be set, if any.
  - `gid`: group id under which the child process must be set, if any.

It returns the last evaluated piece of JS code in `code`, if no timeout is
given. Otherwise, after at most `timeout` milliseconds, the callback gives that
result as a parameter: `function(error, result) {…}`.

Node.js example:

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

# Security

In Node.js, the following barriers are in place:

- The code executes in a process-separated environment, benefitting from
  OS-level security protections such as memory separation. That is true for both
  the asynchronous and the synchronous version.
- The code can be put on a timeout, to ensure it cannot loop indefinitely to
  cause a denial of service.
- The code can be set to a zero-access user ID, ensuring that even if there was
  a vulnerability that allowed file system access, the OS would prevent reading
  confidential information, overwriting it, or executing sensitive code.
- The code executes inside of a V8 isolate, which ensures the execution is
  separated from the process' code (which after all needs enough access to send
  the result back to the main process). Thus the code has a separate object
  graph and cannot affect that of the process it runs in.
  The environment is destroyed afterwards, as the whole process is exited.
- On top of that, the isolate sandbox is crippled: only whitelisted globals are
  accessible. The others are not just syntactically shadowed, but outright
  garbage-collected.

# Warning

## In Node.js

We strongly recommend to set a timeout, and to set a uid and gid.

## In the browser

The following inputs leak:

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
