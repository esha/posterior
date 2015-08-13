(function() {
/*
======== A Handy Little QUnit Reference ========
http://api.qunitjs.com/

Test methods:
  module(name, {[setup][ ,teardown]})
  test(name, callback)
  expect(numberOfAssertions)
  stop(increment)
  start(decrement)
Test assertions:
  ok(value, [message])
  equal(actual, expected, [message])
  notEqual(actual, expected, [message])
  deepEqual(actual, expected, [message])
  notDeepEqual(actual, expected, [message])
  strictEqual(actual, expected, [message])
  notStrictEqual(actual, expected, [message])
  throws(block, [expected], [message])
*/
    module("api");
    var API = Posterior.api;

    test("API exists", function() {
        ok(API);
    });

    test('API.build', function() {
        ok(API.build);
        var config = {},
            fn = API.build(config);
        equal(typeof fn, 'function', 'should return a function');
        ok(fn.cfg, 'should have .cfg');
        ok(fn.cfg._private, '.cfg should have ._private');
        equal(fn.cfg._fn, fn, '.cfg should have ._fn');
    });

    test('API.type', function() {
        ok(API.type);
        strictEqual(API.type({}), 'object');
        strictEqual(API.type([]), 'array');
        strictEqual(API.type(function(){}), 'function');
        strictEqual(API.type(1), 'number');
        strictEqual(API.type(false), 'boolean');
        strictEqual(API.type('hi'), 'string');
        strictEqual(API.type(undefined), null);
        strictEqual(API.type(undefined), null);
    });

    test('API.combineObject', function() {
        ok(API.combineObject);
        var a = {a:true},
            b = {b:false},
            c = API.combine(a, b);
        deepEqual({a:true,b:false}, c, 'check deep equality of combined object');
    });

    test('API.combineFn', function() {
        expect(6);
        ok(API.combineFn);
        var aok,
            bok,
            a = function(arg) {
                aok = true;
                ok(!bok);
                equal(arg, 'arg');
            },
            b = function(arg) {
                bok = true;
                ok(aok);
                equal(arg, 'arg');
            },
            c = API.combine(a, b);
        equal(c('arg'), 'arg');
    });

    test('API.combine', function() {
        equal(typeof API.combine, "function");

        strictEqual(API.combine(1), 1);
        strictEqual(API.combine(null, '2'), '2');
        strictEqual(API.combine(true, undefined), true);

        strictEqual(API.combine('1','2'), '12');
        strictEqual(API.combine(1, 2), 3);
        strictEqual(API.combine(true, false), false);
        strictEqual(API.combine(true, true), true);

        strictEqual(API.combine('1', 2), '12');
        strictEqual(API.combine('1', true), '1true');

        var fn = function(val) {
            equal('val', val);
            return val +'ue';
        };
        strictEqual(API.combine(fn, 'val'), 'value');
        strictEqual(API.combine('val', fn), 'value');

        deepEqual(API.combine([1], 2), [1,2]);
        deepEqual(API.combine(1, [2]), [1,2]);
    });

    test('API.set', function() {
        var fn = function(){},
            cfg = {_fn: fn, _private:{}};

        API.set(cfg, 'foo', true);
        strictEqual(cfg.foo, true);

        API.set(cfg, 'foo', function() {
            strictEqual(this, cfg);
        });
        cfg.foo();

        API.set(cfg, '.prop', 'bar');
        strictEqual(fn.prop, 'bar');

        var build = API.build,
            subcfg = {};
        API.build = function(v, o) {
            strictEqual(o, cfg);
            equal(v, subcfg);
        };
        API.set(cfg, '@sub', subcfg);
        API.build = build;

        API.set(cfg, '_priv', 'ate');
        strictEqual(cfg._private.priv, 'ate');
    });

    var cfg = {
        _private: {
            priv: 'er',
        },
        '!over': 'ride',
        priv: 'ate',
        norm: 'ive',
        _parent: {
            _private: {
                un: 'defined'
            },
            over: 'and out',
            norm: 'at',
            pare: 'ntal'
        }
    };

    test('API.get', function() {
        equal(API.get(cfg, 'priv'), 'ateer');
        equal(API.get(cfg, 'un'), undefined, 'API.get(cfg, "un")');
        equal(API.get(cfg._parent, 'norm'), 'at');
        equal(API.get(cfg, 'norm'), 'ative');
        equal(API.get(cfg, 'over'), 'ride');
        equal(API.get(cfg, 'pare'), 'ntal');
    });

    test('API.getAll', function() {
        var all = API.getAll(cfg);
        deepEqual(all, {
            priv: 'ateer',
            over: 'ride',
            norm: 'ative',
            pare: 'ntal'
        });
    });

    test('API.resolve', function() {
        var data = {
            '@a': 'b',
            deep: {
                nest: [2]
            }
        },
        cfg = {
            prop: 'val'
        };
        equal('b val', API.resolve('${@a} {prop}', cfg, data), 'API.resolve test');
        equal(false, '@a' in data, '@a should not be in data');
        equal('val', cfg.prop, 'cfg.prop should not be consumed');

        var deep = API.resolve('/{deep.nest[0]}', cfg, data);
        equal(deep, '/2', 'should use eval to resolve key');
        equal(data.deep.nest[0], 2, 'should not consume eval\'d data');
    });

    test('API.resolve (but w/o consuming data)', function() {
        var data = {
            '@a': 'b'
        },
        cfg = {
            consumeData: false,
            prop: 'val'
        };
        equal('b val', API.resolve('{@a} ${prop}', cfg, data), 'API.resolve');
        equal(true, '@a' in data, 'should be @a in data');
        equal('val', cfg.prop, 'cfg.prop should be "val"');
    });

    test('API.resolve (from arguments)', function() {
        expect(4);

        var data = ['arg1', 'arg2'],
            filled = API.resolve('/{1}/{0}/', {}, data);
        equal(filled, '/arg2/arg1/', 'should be filled with arguments');
        equal(data.length, 2, 'data should not be consumed from arrays');

        // test it all the way from the top
        var APIpromise = API.promise;
        API.promise = function(cfg) {
            equal(cfg.url, '/uno/dos', 'should be filled properly');
        };
        var backend = new Posterior({
            url: '/${0}/${1}'
        });
        backend('uno', 'dos');

        API.promise = function(cfg) {
            equal(cfg.url, '/uno/', 'should be filled properly');
        };
        backend('uno');

        API.promise = APIpromise;
    });

    test('API.process', function() {
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
        strictEqual(cfg.url, '/data/cfg', 'cfg.url check');
        strictEqual(data.bar, undefined, 'data.bar check');
        strictEqual(data.value, true, 'data.value check');
    });

    test('API.require', function() {
        var count = 0,
            fromString = false,
            fromFunction = false,
            counter = window.counter = function(){ count++; };
        stop();

        API.require('counter').then(function() {
            fromString = true;
            API.require(counter).then(function() {
                fromFunction = true;
                delete window.counter;
                start();
                ok(fromString, 'from string');
                ok(fromFunction, 'from function');
                equal(count, 2, 'counter should have run twice');
            });
        });
    });

    test('API.require fail/catch', function() {
        var count = 0,
            fromString = false,
            fromFunction = false,
            failCounter = window.failCounter = function() {
                count++;
                throw new Error('catch me if you can!');
            };
        stop();

        API.require('failCounter').catch(function() {
            fromString = true;
            API.require(failCounter).catch(function() {
                fromFunction = true;
                delete window.failCounter;
                start();
                ok(fromString, 'from string');
                ok(fromFunction, 'from function');
                equal(count, 2, 'counter should have run twice');
            });
        });
    });

    test('\'parent\' property', function() {
        var base = API({ url: '/base' }, 'base'),
            sub = API({ url: '/sub', parent: base }, 'sub');
        equal('/base/sub', API.get(sub.cfg, 'url'));
    });

    test('extend() function', function() {
        var base = API({ url: '/base' });
        equal(typeof base.extend, "function");
        var sub = base.extend({ url: '/sub' });
        equal('/base/sub', API.get(sub.cfg, 'url'));
        strictEqual(base.cfg, sub.cfg._parent);
    });

    test('getters for properties', function() {
        var base = API({
                string: 'a',
                object: { propA: true }
            }),
            api = API({
                string: 'b',
                object: { propB: true },
                parent: base
            });
        equal('ab', api.string);
        ok(api.object.propA);
        ok(api.object.propB);
    });

    test('make name accessible on cfg', function() {
        var api = API({ foo: true }, 'HasFoo');
        equal('HasFoo', api.cfg.name);
    });

    test('API.main', function() {
        expect(5);
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
            equal(cfg.url, "./index.html", 'called fake main');
            return new FakeResolvedPromise({faked:true});
        };

        var backend = new Posterior({ saveResult: true, url: './index.html' });
        backend().then(function(result, fake) {
            ok(fake, "is fake promise");
            ok(result.faked, "got faked result");
        });

        // ok this should next use a real resolved promise
        stop();
        backend().then(function(result, fake) {
            start();
            ok(!fake, "isn't a fake promise");
            ok(result.faked, "still get faked result");
        });
    });

    test('API.follows', function() {
        expect(5);// 2 calls to fake XHR.main, 2 calls to source fn

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
            equal(cfg.url, "/related/type", 'got link relation as URL');
        };
        var service = function() {
            ok(true, 'called service fn');
            return new FakeResolvedPromise({ _links: { type: { href: '/related/type' }}});
        };

        // test non-heirarchical source
        API.follow({
            follows: {
                source: service,
                path: '_links.type.href'
            }
        });

        // test heirarchical source
        API.follow({
            follows: '_links.type.href'
        }, {
            cfg:{ _parent:{ _fn: service }}
        });

        // test direct URL result
        API.follow({
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
