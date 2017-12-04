export function Posterior<T>(config?: Posterior.InputConfig, name?: string): Posterior.Requester;
export namespace Posterior {
    type XHREventHandler = (this: XHR, event: Event) => any;
    type T = any;
    type U = any;

    interface XHR extends XMLHttpRequest {
        readonly cfg: RequesterConfig;
        readonly responseObject: {};
        readonly responseHeaders: {
            [header: string]: string;
        }
    }
    interface XHRPromise extends Promise<T> {
        readonly xhr: XHR;
    }

    // one per call to Posterior()
    interface InputConfigBase {
        name?: string;
        parent?: Posterior.Requester;

        // basic HTTP
        url?: string | Meta<string>;// must have follows, if no url
        method?: string | Meta<string>;// default is GET
        mimeType?: string | Meta<string>;
        headers?: {
            [header: string]: string | Meta<string>;
        };
        username?: string | Meta<string>;
        password?: string | Meta<string>;

        // behavior configuration
        auto?: boolean | Meta<boolean>;
        singleton?: boolean | Meta<boolean>;
        cache?: boolean | Meta<boolean>;
        debug?: boolean | Meta<boolean>;
        retry?: Retry | Meta<Retry>;
        throttle?: Throttle | Meta<Throttle>;
        json?: boolean | Meta<boolean>;
        requires?: [Requirement] | Meta<[Requirement]>;
        follows?: Follows | Meta<Follows>;
        consumeData?: boolean | Meta<boolean>;

        // handlers
        configure?: ((this: ActiveConfig, cfg: ActiveConfig) => void) | Meta<Function>;
        then?: ((this: ActiveConfig, then: (value: T) => U) => Promise<U>) | Meta<Function>;
        catch?: ((handler: (this: ActiveConfig, error: any, xhr?: XHR) => void | U | Promise<U>) => Promise<U>) | Meta<Function>;

        // XHR specific configuration
        async?: boolean | Meta<boolean>;
        responseType?: XMLHttpRequestResponseType;
        timeout?: Timeout | Meta<Timeout>;
        withCredentials?: boolean | Meta<boolean>;
        msCaching?: string | Meta<string>;
        requestedWith?: string | Meta<string>;

        // request handlers
        requestData?: (data: any) => undefined | any;
        onreadystatechange?: XHREventHandler | Meta<XHREventHandler>;
        error?: XHREventHandler | Meta<XHREventHandler>;
        //timeout?: XHREventHandler | Meta<XHREventHandler>;
        loadstart?: XHREventHandler | Meta<XHREventHandler>;
        loadend?: XHREventHandler | Meta<XHREventHandler>;
        load?: XHREventHandler | Meta<XHREventHandler>;

        // response handlers and status code mapping
        responseData?: ((this: XHR, data: any) => T | XHR) | Meta<Function>;
        failure?: ((this: ActiveConfig, status: number, xhr: XHR) => any) | Meta<Function>;
    }
    interface StatusCodeMapping {
        // status code mapping and mapping handlers
        [statusCode: number]: number | ((xhr: XHR) => number) | Meta<number> | Meta<Function>;
    }
    type InputConfig = InputConfigBase & StatusCodeMapping & {
        Children?: {
            [sub: string]: InputConfig | Meta<InputConfig>;
        };
        Properties?: {
            [custom: string]: any | Meta<any>;
        };
    };
    type Retry = boolean | {
        wait?: number;
        limit?: number;
    };
    type Throttle = {
        key: string,
        ms: number
    };
    type Follows = string | {
        source: Requester | Promiser;
        path: string;
    };
    type Timeout = number | XHREventHandler;
    interface Meta<T> {
        name?: string;
        fullname?: string;
        value: T;
        private?: boolean;
        root?: boolean;
    }

    // one per Requester (structured)
    interface RequesterConfigBase {
        name: string;

        // internals
        _fn: Requester;
        _parent: RequesterConfig | null;
    }
    //TODO: find way to declare only Meta<T> versions from InputConfig
    type RequesterConfig = RequesterConfigBase & InputConfig;

    // one per call (flattened, filled, and called)
    interface ActiveConfigBase {
        _args: [any];
        data: [any] | {};
        _singletonResult?: T;
    }
    type ActiveConfig = ActiveConfigBase & RequesterConfig;

    const version: string;

    function xhr(cfg: ActiveConfig): XHRPromise;
    namespace xhr {
        // utilities
        function isData(data: any): boolean;
        function safeCopy<O>(object: O, copied: undefined | [string]): O;

        // manual configuration
        const methodMap: {
            [METHOD: string]: string;
        };
        let activeClass: undefined | string;

        // extension possibilites
        let ctor: XHR;
        let active: number;
        function notify(isActive: boolean): void;
        function method(cfg: ActiveConfig): string;
        function url(cfg: ActiveConfig): string;
        function key(cfg: ActiveConfig): string;
        function cache(xhr: XHR): XHR;

        // override at your own risk
        function promise(xhr: XHR, cfg: ActiveConfig): Promise<T>;
        function main(cfg: ActiveConfig): XHRPromise;
        function config(xhr: XHR, cfg: ActiveConfig): void;
        function retry(cfg: ActiveConfig, retry: boolean | {}, events: {}, fail: (e: Event) => void): void;
        function throttle(xhr: XHR, cfg: ActiveConfig, events: {}, fail: (e: Event) => void): void;
        const throttles: {
            [key: string]: {
                queue: number;
                lastRun: number;
            }
        };
        function run(xhr: XHR, cfg: ActiveConfig, events: {}, fail: (e: Event) => void): void;
        function load(cfg: ActiveConfig, resolve: (value: T) => void, reject: (error: any) => void): () => void;
        function forceJSONResponse(xhr: XHR): void;
        function data(cfg: ActiveConfig): any;
        function start(): void;
        function end(): void;
    }

    type Promiser = (...input: any[]) => Promise<T>;
    interface RequesterBase extends InputConfigBase {
        cfg: RequesterConfig;
        config(name: string, value: any): any;
        extend(config: InputConfig, name: string): Requester;
    }
    type RequesterFn = (...requestData: any[]) => XHRPromise;
    type Requester = RequesterFn & RequesterBase;
    type Requirement = string | Requester | Promiser;

    function api(config: InputConfig, name?: string): Requester;
    namespace api {
        // building
        function build(config: InputConfig, parent: RequesterConfig, name: string): Requester;
        function debug(name: string, fn: Requester): Requester;
        function setAll(cfg: InputConfig, config: RequesterConfig): void;
        function set(cfg: RequesterConfig, prop: string, value: any, parentName: string): void;
        function getter(fn: Requester, name: string): void;
        const meta: {
            chars: [string];
            _: (meta: Meta<any>, api?: Requester) => void;
            '!': (meta: Meta<any>, api?: Requester) => void;
            '@': (meta: Meta<any>, api?: Requester) => void;
        };

        // utility
        function get(cfg: RequesterConfig, name: string, inheriting?: boolean): any;

        // user-facing (on all Requesters)
        function config(name: string, value: any): any;
        function extend(config: InputConfig, name: string): Requester;

        // requesting
        function main(fn: Requester, args: [any]): XHRPromise | Promise<T>;
        function getAll(cfg: RequesterConfig, inheriting?: boolean): ActiveConfig;
        function process(cfg: ActiveConfig): void;
        function promise(cfg: ActiveConfig, fn: Requester): XHRPromise | Promise<T>;
        function require(req: Requirement): Promise<T>;
        function follow(cfg: ActiveConfig, fn: Requester): XHRPromise | Promise<T>;

        // resolving/combining config values
        function resolve(string: string, data: [any] | {}, cfg: ActiveConfig, consume: boolean | undefined): string;
        function copy(to: ActiveConfig, from: RequesterConfig): void;
        function log(args: [any], level: string): void;
        function combine(pval: any, val: any, cfg: ActiveConfig): any;
        function combineFn(pfn: Function, fn: Function): Function;
        function combineObject(pobj: {}, obj: {}): {};
        function type(val: any): string;
    }
}

export default Posterior;
