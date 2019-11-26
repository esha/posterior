(function() {
/*
======== A Handy Little QUnit Reference ========
http://api.qunitjs.com/

Test methods:
  QUnit.module(name, {[setup][ ,teardown]})
  QUnit.test(name, callback)
  assert.expect(numberOfAssertions)
  stop(increment)
  start(decrement)
Test assertions:
  assert.ok(value, [message])
  assert.equal(actual, expected, [message])
  assert.notEqual(actual, expected, [message])
  assert.deepEqual(actual, expected, [message])
  notDeepEqual(actual, expected, [message])
  assert.strictEqual(actual, expected, [message])
  notStrictEqual(actual, expected, [message])
  throws(block, [expected], [message])
*/
    QUnit.module("frame");

    QUnit.test("API exists", function(assert) {
        assert.equal(typeof Posterior, "function");
        assert.equal(typeof Posterior.version, "string");
    });

}());
