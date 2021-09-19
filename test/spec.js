var assert = require('assert');
var localeval = require('..');
describe('synchronous localeval', function() {
  it('basics', function() {
    assert.equal(localeval(`1+1`), 2);

    var foo = 1;
    [
      `foo = 'leak'`,
      `this.foo = 'leak'`,
      `Function("this.foo = 'leak'")()`,
      `eval("foo = 'leak'")`,
    ].forEach(attempt => localeval(attempt));
    assert.equal(foo, 1);

    assert.throws(() =>
      localeval(`({}).constructor.constructor('return foo')()`),
      /foo is not defined/);

    localeval(`String.prototype.slice = function() { return 'leaked'; };`);
    assert.equal('nice'.slice(1), 'ice');

    localeval(`String.prototype.leak = function() { return 'leak'; }`);
    assert.equal(String.prototype.leak, undefined);

    localeval(`([]).__proto__.push = function(a) { return "leaked"; };`);
    assert.equal([].push(1), 1);

    localeval(`String.fromCharCode = function() { return 'leaked'; };`);
    assert.equal(String.fromCharCode(42), '*');

    localeval(`delete Number.parseInt`);
    assert.equal(Number.parseInt('1337'), 1337);

    localeval(`({}).constructor.getOwnPropertyNames = function(){return 'leak';}`);
    assert.deepEqual(Object.getOwnPropertyNames(1), []);
  });

  it('timeout', function() {
    assert.throws(() => localeval(`for (;;) {}`, {}, 1), /ETIMEDOUT/);

    assert.throws(() => localeval(`function(a, n) {` +
          `if (n > 0) return a + a;` +
          `else return a;` +
        `}("leak", 1e9);`, {}, 1),
      /ETIMEDOUT/);
  });

  it('uid and gid', function() {
    assert.throws(() =>
      localeval(`({}).constructor.constructor("process.kill(process.ppid)")()`,
        {}, {uid: 'games', gid: 'games'}),
      /EPERM/);
  });

  it('forbidden globals', function() {
    assert.throws(() =>
      localeval(`this.constructor.constructor('process.exit(0)')()`),
      /Cannot read property 'constructor' of null/);

    assert.throws(() =>
      localeval(`({}).constructor.constructor("return process.getgroups()")()`),
      /process is not defined/);
  });
});
