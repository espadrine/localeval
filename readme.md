# Local Eval

Evaluate a string of JS code without access to the global object.

Always use that instead of `eval()`. Always.

(Eventual) API:

```javascript
    var localeval = require('localeval');
    localeval('console.log("Do I have access to the console?")');  // Throws.
```

# Warning

Those only describe current limitations, and may be lifted in the future.

1. Evaluated code can still fiddle with some global object's properties.
   Think
   `localeval('([]).__proto__.push = function(a) { return "nope"; }')`.
   It even crashes node in command-line mode.

2. It doesn't protect your single-threaded code against infinite loops.

# Purpose

Trying to find a reasonable cross-environment ES5 sandbox evaluation function.
