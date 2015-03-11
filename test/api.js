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
        equal(typeof fn, 'function');
        ok(fn.cfg);
        ok(fn.cfg._private);
        equal(fn.cfg._fn, fn);
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
        deepEqual({a:true,b:false}, c);
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
        equal(API.get(cfg, 'un'), undefined);
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

    test('API.fill', function() {
        var data = {
            '@a': 'b'
        },
        cfg = {
            prop: 'val'
        };
        equal('b val', API.fill('${@a} ${prop}', cfg, data));
        equal(false, '@a' in data);
        equal('val', cfg.prop);
    });

    test('API.process', function() {
        var cfg = {
            url: '/${data}/${cfg}',
            cfg: 'cfg',
            data: {
                data: 'data',
                value: true
            }
        };
        API.process(cfg);
        var data = cfg.data;
        strictEqual(cfg.url, '/data/cfg');
        strictEqual(data.bar, undefined);
        strictEqual(data.value, true);
    });

    test('API.require', function() {
        var req = function() {
            ok('req', 'executed requires fn');
        };
        API.require('req').then(function() {
            equal('string','string');
        }).catch(function() {
            equal('string', 'req');
        });
        API.require(req).then(function() {
            strictEqual('function','function');
        }).catch(function() {
            strictEqual('function', req);
        });
    });

    test('\'extend\' property', function() {
        var base = API({ url: '/base' }, 'base'),
            sub = API({ url: '/sub', extend: base }, 'sub');
        equal('/base/sub', API.get(sub.cfg, 'url'));
    });

}());
