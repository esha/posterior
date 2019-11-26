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
    QUnit.module("api");
    var API = Posterior.api;

    QUnit.test("API exists", function(assert) {
        assert.ok(API);
    });

    QUnit.test('API.build', function(assert) {
        assert.ok(API.build);
        var inCfg = {},
            fn = API.build(inCfg);
        assert.equal(typeof fn, 'function', 'should return a function');
        assert.ok(fn.metaCfg, 'should have .metaCfg');
        assert.equal(typeof fn.metaCfg.name, "string", '.metaCfg should have a name');
        assert.ok('_parent' in fn.metaCfg, '.metaCfg should have _parent defined');
        assert.equal(fn.metaCfg._fn, fn, '.metaCfg should have ._fn');
    });

    QUnit.test('API.type', function(assert) {
        assert.ok(API.type);
        assert.strictEqual(API.type({}), 'object');
        assert.strictEqual(API.type([]), 'array');
        assert.strictEqual(API.type(function(){}), 'function');
        assert.strictEqual(API.type(1), 'number');
        assert.strictEqual(API.type(false), 'boolean');
        assert.strictEqual(API.type('hi'), 'string');
        assert.strictEqual(API.type(undefined), null);
        assert.strictEqual(API.type(undefined), null);
    });

    QUnit.test('API.combineObject', function(assert) {
        assert.ok(API.combineObject);
        var a = {a:true},
            b = {b:false},
            c = API.combine(a, b);
        assert.deepEqual({a:true,b:false}, c, 'check deep equality of combined object');
    });

    QUnit.test('API.combineFn', function(assert) {
        assert.expect(6);
        assert.ok(API.combineFn);
        var aok,
            bok,
            a = function(arg) {
                aok = true;
                assert.ok(!bok);
                assert.equal(arg, 'arg');
            },
            b = function(arg) {
                bok = true;
                assert.ok(aok);
                assert.equal(arg, 'arg');
            },
            c = API.combine(a, b);
        assert.equal(c('arg'), 'arg');
    });

    QUnit.test('API.combine', function(assert) {
        assert.equal(typeof API.combine, "function");

        assert.strictEqual(API.combine(1), 1);
        assert.strictEqual(API.combine(null, '2'), '2');
        assert.strictEqual(API.combine(true, undefined), true);

        assert.strictEqual(API.combine('1','2'), '12');
        assert.strictEqual(API.combine(1, 2), 3);
        assert.strictEqual(API.combine(true, false), false);
        assert.strictEqual(API.combine(true, true), true);

        assert.strictEqual(API.combine('1', 2), '12');
        assert.strictEqual(API.combine('1', true), '1true');

        var fn = function(val) {
            assert.equal('val', val);
            return val +'ue';
        };
        assert.strictEqual(API.combine(fn, 'val'), 'value');
        assert.strictEqual(API.combine('val', fn), 'value');

        assert.deepEqual(API.combine([1], 2), [1,2]);
        assert.deepEqual(API.combine(1, [2]), [1,2]);
    });

    QUnit.test('API.setAll', function(assert) {
        var cfg = { _fn: function(){} },
            config = { Children: { foo: 'bar' }};
        API.setAll(cfg, config);
        assert.equal(cfg.foo.value, 'bar');
    });

    QUnit.test('API.set', function(assert) {
        assert.expect(9);
        var fn = function(){},
            cfg = {_fn: fn};
        fn.metaCfg = cfg;

        API.set(cfg, 'foo', true);
        assert.strictEqual(cfg.foo.value, true);

        API.set(cfg, 'foo', function() {
            assert.notEqual(this, cfg, 'value fn context should no longer be bound to cfg');
        });
        cfg.foo.value();

        API.set(cfg, 'prop2', 'bar2');
        assert.strictEqual(fn.prop2, 'bar2');

        var build = API.build,
            subcfg = {};
        API.build = function(v, o) {
            assert.strictEqual(o, cfg, 'build should get cfg as 2nd arg');
            assert.equal(v, subcfg, 'build should get subcfg as 1st arg');
        };
        API.set(cfg, 'Sub', subcfg);
        API.set(cfg, '@sub', subcfg);
        API.build = build;

        API.set(cfg, '_priv', 'ate');
        assert.strictEqual(cfg.priv.private, true);
        assert.strictEqual(cfg.priv.value, 'ate');

        //TODO: test roots
    });

    var cfg = {
        priv: { private: true, value: 'ateer' },
        over: { root: true, value: 'ride' },
        norm: { value: 'ive' },
        _parent: {
            un: { private: true, value: 'defined' },
            over: { value: 'and out' },
            norm: { value: 'at' },
            pare: { value: 'ntal' }
        }
    };

    QUnit.test('API.get', function(assert) {
        assert.equal(API.get(cfg, 'priv'), 'ateer');
        assert.equal(API.get(cfg, 'un'), undefined, 'API.get(cfg, "un")');
        assert.equal(API.get(cfg._parent, 'norm'), 'at');
        assert.equal(API.get(cfg, 'norm'), 'ative');
        assert.equal(API.get(cfg, 'over'), 'ride');
        assert.equal(API.get(cfg, 'pare'), 'ntal');
    });

    QUnit.test('API.getAll', function(assert) {
        var all = API.getAll(cfg);
        assert.deepEqual(all, {
            priv: 'ateer',
            over: 'ride',
            norm: 'ative',
            pare: 'ntal'
        });
    });

    QUnit.test('API.elevate', function(assert) {
        var config = {
            Children: { url: 'test', method: 'POST' },
            Properties: { num: 42 }
        };
        API.elevate('Properties', config);
        API.elevate('Children', config);
        assert.equal(config.url, 'test');
        assert.equal(config.method, 'POST');
        assert.equal(config.num, 42);
    });

    QUnit.test('API.resolve', function(assert) {
        var data = {
            '@a': 'b',
            deep: {
                nest: [2]
            }
        },
        cfg = {
            prop: 'val'
        };
        assert.equal('b val b', API.resolve('${@a} {prop} {@a}', data, cfg), 'API.resolve test');
        assert.equal(false, '@a' in data, '@a should not be in data');
        assert.equal('val', cfg.prop, 'cfg.prop should not be consumed');

        var deep = API.resolve('/{deep.nest[0]}', data, cfg);
        assert.equal(deep, '/2', 'should use eval to resolve key');
        assert.equal(data.deep.nest[0], 2, 'should not consume eval\'d data');

        data = ["hello", "cruel", "world"];
        assert.equal('hello world, hello!', API.resolve('{0} {2}, {0}!', data), 'API.resolve array, multiple index use');
        assert.equal(1, data.length, 'array data should be consumed');
        assert.equal("cruel", data[0], 'correct array data should be consumed');
    });

    QUnit.test('API.resolve (but w/o consuming data)', function(assert) {
        var data = {
            '@a': 'b'
        },
        cfg = {
            consumeData: false,
            prop: 'val'
        };
        assert.equal('b val', API.resolve('{@a} ${prop}', data, cfg, cfg.consumeData), 'API.resolve');
        assert.equal(true, '@a' in data, 'should be @a in data');
        assert.equal('val', cfg.prop, 'cfg.prop should be "val"');

        var unconsumed = API.resolve('-{@a}-', data, null, false);
        assert.equal('-b-', unconsumed, 'API.resolve w/no config and consume:false');
        assert.equal(true, '@a' in data, '@a should remain in data');

        var consumed = API.resolve('-{@a}-', data, cfg, true);
        assert.equal('-b-', consumed, 'API.resolve w/cfg.consumeData:false and consume:true');
        assert.equal(false, '@a' in data, '@a should not remain in data');
    });

    QUnit.test('API.resolve (from arguments)', function(assert) {
        assert.expect(4);

        var data = ['arg1', 'arg2'],
            filled = API.resolve('/{1}/{0}/', data);
        assert.equal(filled, '/arg2/arg1/', 'should be filled with arguments');
        assert.equal(data.length, 0, 'data should be consumed from arrays');

        // test it all the way from the top
        var APIpromise = API.promise;
        API.promise = function(cfg) {
            assert.equal(cfg.url, '/uno/dos', 'should be filled properly');
        };
        var backend = new Posterior({
            url: '/${0}/${1}'
        });
        backend('uno', 'dos');

        API.promise = function(cfg) {
            assert.equal(cfg.url, '/uno/', 'should be filled properly');
        };
        backend('uno');

        API.promise = APIpromise;
    });

    QUnit.test('API.process', function(assert) {
        var cfg = {
            url: '/${data}/{cfg}',
            cfg: 'cfg',
            data: {
                data: 'data',
                value: true
            }
        };
        API.process(cfg);
        var data = cfg.data;
        assert.strictEqual(cfg.url, '/data/cfg', 'cfg.url check');
        assert.strictEqual(data.bar, undefined, 'data.bar check');
        assert.strictEqual(data.value, true, 'data.value check');
    });

    QUnit.test('API.require', function(assert) {
        var count = 0,
            fromString = false,
            fromFunction = false,
            counter = window.counter = function(){ count++; };
        var done = assert.async();

        API.require('counter').then(function() {
            fromString = true;
            API.require(counter).then(function() {
                fromFunction = true;
                delete window.counter;
                done();
                assert.ok(fromString, 'from string');
                assert.ok(fromFunction, 'from function');
                assert.equal(count, 2, 'counter should have run twice');
            });
        });
    });

    QUnit.test('API.require fail/catch', function(assert) {
        var count = 0,
            fromString = false,
            fromFunction = false,
            failCounter = window.failCounter = function() {
                count++;
                throw new Error('catch me if you can!');
            };
        var done = assert.async();

        API.require('failCounter').catch(function() {
            fromString = true;
            API.require(failCounter).catch(function() {
                fromFunction = true;
                delete window.failCounter;
                done();
                assert.ok(fromString, 'from string');
                assert.ok(fromFunction, 'from function');
                assert.equal(count, 2, 'counter should have run twice');
            });
        });
    });

    QUnit.test('ensure parent gets set via nested subcfg', function(assert) {
        var base = API({
            url: 'http://esha.com',
            Sub: {
                url: '/test'
            }
        });
        assert.equal(base.Sub.config('url'), 'http://esha.com/test');
    });

    QUnit.test('\'parent\' property', function(assert) {
        var base = API({ url: '/base' }, 'base'),
            sub = API({ url: '/sub', parent: base }, 'sub');
        assert.equal('/base/sub', API.get(sub.metaCfg, 'url'));
    });

    QUnit.test('extend() function', function(assert) {
        var base = API({ url: '/base' });
        assert.equal(typeof base.extend, "function");
        var sub = base.extend({ url: '/sub' });
        assert.equal('/base/sub', API.get(sub.metaCfg, 'url'));
        assert.strictEqual(base.metaCfg, sub.metaCfg._parent);
    });

    QUnit.test('getters for properties', function(assert) {
        var base = API({
                string: 'a',
                object: { propA: true }
            }),
            api = API({
                string: 'b',
                object: { propB: true },
                parent: base
            });
        assert.equal('ab', api.string);
        assert.ok(api.object.propA);
        assert.ok(api.object.propB);
    });

    QUnit.test('make name accessible on cfg', function(assert) {
        var api = API({ foo: true }, 'HasFoo');
        assert.equal('HasFoo', api.metaCfg.name);
    });

    QUnit.test('API.main', function(assert) {
        assert.expect(5);
        var XHR = Posterior.xhr,
            XHRmain = XHR.main;

        // this is to allow synchronous resolution of tests
        function FakeResolvedPromise(value) {
            this.value = value;
        }
        FakeResolvedPromise.prototype.then = function(fn) {
            var val = fn(this.value, true);
            return new FakeResolvedPromise(val);
        };

        XHR.main = function(cfg) {
            XHR.main = XHRmain;
            assert.equal(cfg.url, "./index.html", 'called fake main');
            return new FakeResolvedPromise({faked:true});
        };

        var backend = new Posterior({ singleton: true, url: './index.html' });
        backend().then(function(result, fake) {
            assert.ok(fake, "is fake promise");
            assert.ok(result.faked, "got faked result");
        });

        // ok this should next use a real resolved promise
        var done = assert.async();
        backend().then(function(result, fake) {
            done();
            assert.ok(!fake, "isn't a fake promise");
            assert.ok(result.faked, "still get faked result");
        });
    });

    QUnit.test('API.follows', function(assert) {
        assert.expect(5);// 2 calls to fake XHR.main, 2 calls to source fn

        // fake XHR.main and promises to allow synchronous resolution
        var XHR = Posterior.xhr,
            XHRmain = XHR.main;

        function FakeResolvedPromise(value) {
            this.value = value;
        }
        FakeResolvedPromise.prototype.then = function(fn) {
            var val = fn(this.value, true);
            return new FakeResolvedPromise(val);
        };

        XHR.main = function(cfg) {
            assert.equal(cfg.url, "/related/type", 'got link relation as URL');
        };
        var service = function() {
            assert.ok(true, 'called service fn');
            return new FakeResolvedPromise({ _links: { type: { href: '/related/type' }}});
        };

        // test non-heirarchical source
        API.follow({
            metaCfg: {name:'test'},
            follows: {
                source: service,
                path: '_links.type.href'
            }
        });

        // test heirarchical source
        API.follow({
            metaCfg: {name:'test'},
            follows: '_links.type.href'
        }, {
            metaCfg:{ _parent:{ _fn: service }}
        });

        // test direct URL result
        API.follow({
            metaCfg: {name:'test'},
            follows: {
                source: function() {
                    return new FakeResolvedPromise("/related/type");
                }
            }
        });

        // restore proper main function
        XHR.main = XHRmain;
    });

}());
