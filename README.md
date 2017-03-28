[Posterior][home] Give your backend services intuitive front-end interfaces (uses XHR, JSON, Promise) via declarative, hierarchical configurations.

[home]: http://esha.github.io/posterior

Download: [posterior.min.js][min] or [posterior.js][full] [![Build Status](https://travis-ci.org/esha/posterior.png?branch=master)](https://travis-ci.org/esha/posterior)  
[Bower][bower]: `bower install posterior`  
[NPM][npm]: `npm install posterior`   
[Component][component]: `component install esha/posterior`  


[![Build Status](https://travis-ci.org/esha/posterior.png?branch=master)](https://travis-ci.org/esha/posterior)
[![npm version](https://badge.fury.io/js/posterior.svg)](https://badge.fury.io/js/store)
[![npm](https://img.shields.io/npm/dm/posterior.svg?maxAge=2592000)](https://www.npmjs.com/package/posterior)  

[full]: https://raw.github.com/esha/posterior/master/dist/posterior.js
[min]: https://raw.github.com/esha/posterior/master/dist/posterior.min.js
[npm]: https://npmjs.org/package/posterior
[bower]: http://bower.io/
[component]: http://component.io/

### Example
```javascript
var GitHub = new Posterior({
    url: 'https://api.github.com',
    load: function() {
        console.log('Requested:', this.cfg.url);
    },
    ESHA: {
        url: '/repos/esha/{0}',
        Version: {
            follows: 'tags_url',
            then: function(tags) {
                return tags[0].name;
            }
        }
    }
}, 'GitHub');

GitHub.ESHA.Version('posterior');
```

### Release History
* 2014-09-08 [v0.1.4][] (initial)
* 2014-09-09 [v0.2.3][] (debug mode, preprocess, no global)
* 2014-09-16 [v0.3.1][] (timeout->error, async fix, direct XHR cfg, status mapping)
* 2014-09-17 [v0.4.0][] (retry options, css activity notification)
* 2014-09-19 [v0.5.4][] (XHR tests, json cfg shortcut, better structure, safer copy, responseObject property, et al)
* 2014-09-24 [v0.6.2][] (s/serialize/transformData, s/preprocess/configure, better debug output)
* 2014-10-13 [v0.7.3][] (support all XHR events, JSON default, resolve/reject promise with response/error, request/responseData handler support)
* 2015-03-12 [v0.9.3][] (switch to better Promise polyfill, rename to Posterior, support 'parent' property, expose config props with getters)
* 2015-07-28 [v0.10.1][] (fix retry, cache, and require features)
* 2015-08-05 [v0.11.0][] (support both ${key} and {key} in URL templates)
* 2015-08-08 [v0.12.0][] (s/share(d)Result/save(d)Result, and support dynamic link relations via new 'follows' property)
* 2015-08-13 [v0.13.0][] (upgrade config string filling to also resolve args by index and nested data)
* 2016-05-18 [v0.14.1][] (support failure listener for non-200 status codes, pass XHR to configured catch functions, don't override specified Accept or Content-Type headers)
* 2016-05-20 [v0.15.0][] (API.resolve can now support repeated replacements when consuming data, consume array data, and is easier to use as util)
* 2016-05-23 [v0.16.0][] (add throttle:{key,ms} support)

[v0.1.4]: https://github.com/esha/posterior/tree/0.1.4
[v0.2.3]: https://github.com/esha/posterior/tree/0.2.3
[v0.3.1]: https://github.com/esha/posterior/tree/0.3.1
[v0.4.0]: https://github.com/esha/posterior/tree/0.4.0
[v0.5.4]: https://github.com/esha/posterior/tree/0.5.4
[v0.6.2]: https://github.com/esha/posterior/tree/0.6.2
[v0.7.3]: https://github.com/esha/posterior/tree/0.7.3
[v0.9.3]: https://github.com/esha/posterior/tree/0.9.3
[v0.10.1]: https://github.com/esha/posterior/tree/0.10.1
[v0.11.0]: https://github.com/esha/posterior/tree/0.11.0
[v0.12.0]: https://github.com/esha/posterior/tree/0.12.0
[v0.13.0]: https://github.com/esha/posterior/tree/0.13.0
[v0.14.1]: https://github.com/esha/posterior/tree/0.14.1
[v0.15.0]: https://github.com/esha/posterior/tree/0.15.0
[v0.16.0]: https://github.com/esha/posterior/tree/0.16.0
