# Local Eval

Evaluate a string of JS code without access to the global object.

Always use that instead of `eval()`. Always.

(Eventual) API:

    localeval(code :: String, sandbox :: Object) :: Object.

The `code` is a string of JS code. The `sandbox` contains objects which are
going to be accessible in the JS code.
It returns the last evaluated piece of JS code in `code`.

Node example:

```javascript
var localeval = require('localeval');
localeval('console.log("Do I have access to the console?")');  // Throws.
```

Browser example:

```html
<!doctype html>
<script src='localeval.js'></script>
<!-- Alerts "32". -->
<script> alert(localeval('a + b', {a: 14, b: 18})) </script>
```

# Warning

Those only describe current limitations in browsers, and may be lifted in the
future.

1. Evaluated code can still fiddle with some global object's properties.
   Think
   `localeval('([]).__proto__.push = function(a) { return "nope"; }')`.
   It even crashes node in command-line mode.

2. It doesn't protect your single-threaded code against infinite loops.

# Purpose

Trying to find a reasonable cross-environment ES5 sandbox evaluation function.
