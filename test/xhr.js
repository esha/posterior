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
    module("xhr");
    var XHR = JCX.xhr;

    test("API exists", function() {
        ok(XHR);
        ok('responseObject' in XMLHttpRequest.prototype);
        ok('responseHeaders' in XMLHttpRequest.prototype);
    });

    function FakeXHR() {
        this._headers = {};
    }
    FakeXHR.prototype.timeout = null;
    FakeXHR.prototype.open = function(method, url, async, user, pass) {
        this._method = method;
        this._url = url;
        this._async = async;
        this._username = user;
        this._password = pass;
    };
    FakeXHR.prototype.overrideMimeType = function(type) {
        this._mimeType = type;
    };
    FakeXHR.prototype.setRequestHeader = function(name, value) {
        this._headers[name] = value;
    };
    FakeXHR.prototype.send = function(data) {
        if (this.onloadstart) {
            this.onloadstart();
        }
        switch (data) {
            case 'error':
                this.status = 500;
                this.onerror(data);
            break;
            case 'timeout':
                if (this.ontimeout) {
                    this.ontimeout(data);
                }
            break;
            default:
                this.status = 200;
                this.responseText = this.cfg.response || data;
                this.onload();
            break;
        }
        if (this.onloadend) {
            this.onloadend();
        }
    };
    Object.defineProperties(FakeXHR.prototype, XHR.properties);

    test('XHR.main', function() {
        expect(5);
        XHR.ctor = FakeXHR;
        var promise = XHR({
            url: '/main',
            response: '{"json":true}',
            always: function(xhr) {
                start();
                equal(xhr._url, '/main');
                equal(xhr._method, 'GET');
                stop();
                return xhr;
            }
        });
        ok(promise.xhr instanceof FakeXHR, 'promise.xhr should be fake');
        stop();
        promise.then(function(xhr) {
            start();
            ok(xhr instanceof FakeXHR, 'argument should be FakeXHR');
            ok(xhr.responseObject.json, 'should get json response');
        });
        delete XHR.ctor;
    });

    test('XHR.config', function() {
        var xhr = new FakeXHR(),
            cfg = {
                url: '/foo/../bar',
                username: 'test',
                password: 'this',
                mimeType: 'application/json',
                requestedWith: false,
                json: true,
                headers: {
                    Whatever: 'You Want'
                },
                timeout: 2000,
                ignoreme: 'ignored'
            };
        XHR.config(xhr, cfg);
        strictEqual(xhr.cfg, cfg);
        equal(xhr._url, '/bar');
        equal(xhr._method, 'GET');
        strictEqual(xhr._async, true);
        equal(xhr._username, 'test');
        equal(xhr._password, 'this');
        equal(xhr._mimeType, 'application/json');
        strictEqual(xhr._headers['X-Requested-With'], undefined);
        equal(xhr.responseType, 'json');
        equal(xhr._headers.Accept, 'application/json');
        equal(xhr._headers['Content-Type'], 'application/json');
        equal(xhr._headers.Whatever, 'You Want');
        strictEqual(xhr.ignoreme, undefined);
        strictEqual(xhr.timeout, cfg.timeout);

        cfg = {
            url: '/',
            method: 'POST',
            async: false
        };
        xhr = new FakeXHR();
        XHR.config(xhr, cfg);
        strictEqual(xhr._async, false);
        equal(xhr._method, 'POST');
        equal(xhr._headers['X-Requested-With'], 'XMLHttpRequest');
        strictEqual(xhr._headers.Accept, undefined);
    });

    test('XHR.promise', function() {
        var xhr = new FakeXHR(),
            cfg = {
                data: { test: true },
                json: true
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        ok(promise instanceof Promise);
        stop();
        promise.then(function(fake) {
            start();
            equal(fake.status, 200);
            deepEqual(fake.response, fake.responseObject);
            deepEqual(fake.response, { test: true });
        });

        xhr = new FakeXHR();
        cfg = {
            data: 'error'
        };
        XHR.config(xhr, cfg);
        promise = XHR.promise(xhr, cfg);
        stop();
        promise.catch(function(fake) {
            start();
            equal(fake.status, 500);
            equal(fake.error, 'error');
        });

        xhr = new FakeXHR();
        cfg = {
            data: 'timeout',
            timeout: 200
        };
        XHR.config(xhr, cfg);
        promise = XHR.promise(xhr, cfg);
        stop();
        promise.catch(function(fake) {
            start();
            ok(!fake.status);
            equal(fake.error, 'timeout');
        });
    });

    test('XHR.method', function() {
        var cfg = {method:'PATCH'};
        equal(XHR.method(cfg), 'POST');
        equal(XHR.method({}), 'GET');
        cfg.method = 'DELETE';
        equal(XHR.method(cfg), 'DELETE');
    });

    test('XHR.data', function() {
        var cfg = { data: true };
        strictEqual(XHR.data(cfg), 'true');
        cfg = { data: {json:'yep'}};
        strictEqual(XHR.data(cfg), '{"json":"yep"}');
        cfg = {data : 0, serialize: function(data){ return data ? data : ''; }};
        strictEqual(XHR.data(cfg), '');
    });

    test('XHR.start/end', function() {
        equal(XHR.active, 0);
        equal(XHR.activeClass, 'xhr-active');
        var htmlClass = document.documentElement.classList;
        ok(!htmlClass.contains(XHR.activeClass));
        XHR.start();
        ok(htmlClass.contains(XHR.activeClass));
        equal(XHR.active, 1);
        XHR.start();
        equal(XHR.active, 2);
        XHR.end();
        equal(XHR.active, 1);
        ok(htmlClass.contains(XHR.activeClass));
        XHR.end();
        equal(XHR.active, 0);
        ok(!htmlClass.contains(XHR.activeClass));
    });

    test('XHR.url', function() {
        var cfg = { url: 'foo/../bar' };
        equal(XHR.url(cfg), 'bar');
    });

    test('XHR.key', function() {
        var cfg = { url: '/x/../test', method:'PATCH', data: {test:2.2} };
        equal(XHR.key(cfg), '/test|POST|{"test":2.2}');
    });

    test('XHR.safeCopy', function() {
        var xhr = {
            good: true,
            bad: function(){}
        };
        deepEqual(XHR.safeCopy(xhr), {good:true}, 'should not copy functions');

        xhr = { nest: { bad: false } };
        xhr.nest.parent = xhr;
        deepEqual(XHR.safeCopy(xhr), {nest:{bad:false}}, 'should not copy circular refs');
    });

    test('XHR.forceJSONResponse', function() {
        var xhr = new FakeXHR();
        xhr.responseText = '{"foo":true}';
        Object.defineProperty(xhr, 'response', {
            value: xhr.responseText,
            configurable: true,
            writable: false
        });

        try {
            xhr.response = 'fail';
        } catch (e) {}
        strictEqual(xhr.response, xhr.responseText);
        XHR.forceJSONResponse(xhr);
        deepEqual(xhr.response, {foo:true});
        strictEqual(xhr.responseObject, xhr.response);
    });

    test('XHR.chain', function() {
        expect(10);
        var fn = function(xhr) {
            ok(true, 'fn should be called');
            if (xhr.ret) {
                return xhr.ret;
            }
        },
        rfn = XHR.chain(fn);
        equal(typeof rfn, 'function', 'chain returns a function');
        notStrictEqual(fn, rfn, 'chain returns a different function');
        
        equal(rfn({ ret:'chain' }), 'chain', 'should let functions change result');
        
        var xhr = {};
        equal(rfn(xhr), xhr, 'should pass thru good xhr');

        xhr = { error: 404 };
        var rejected = rfn(xhr);
        notEqual(rejected, xhr, 'should not pass bad xhr');
        ok(rejected instanceof Promise, 'bad xhr returns rejected promise');
        stop();
        rejected.then(function() {
            start();
            ok(false, 'should not be resolved');
        }, function(o) {
            start();
            equal(o, xhr, 'rejected promise handlers should still get xhr');
        });
    });

}());
