declare namespace Posterior {
    type XHREventHandler = (this: XHR, event: Event) => any | Function;
    type T = any;
    type U = any;

    export interface XHR extends XMLHttpRequest {
        readonly cfg: MetaConfig;
        readonly responseObject: {};
        readonly responseHeaders: {
            [header: string]: string;
        }
    }
    export interface XHRPromise extends Promise<T> {
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
        debug?: boolean | string | Meta<boolean | string>;
        retry?: Retry | Meta<Retry>;
        throttle?: Throttle | Meta<Throttle>;
        json?: boolean | Meta<boolean>;
        requires?: [Requirement] | Meta<[Requirement]>;
        follows?: Follows | Meta<Follows>;
        consumeData?: boolean | Meta<boolean>;

        // handlers
        configure?: ((this: MetaConfig, cfg: RunConfig) => void) | Function | Meta<Function>;
        then?: ((this: MetaConfig, then: (value: T) => U) => Promise<U>) | Function | Meta<Function>;
        catch?: ((handler: (this: MetaConfig, error: any, xhr?: XHR) => void | U | Promise<U>) => Promise<U>) | Function | Meta<Function>;

        // XHR specific configuration
        async?: boolean | Meta<boolean>;
        responseType?: XMLHttpRequestResponseType;
        timeout?: Timeout | Meta<Timeout>;
        withCredentials?: boolean | Meta<boolean>;
        msCaching?: string | Meta<string>;
        requestedWith?: string | Meta<string>;

        // request handlers
        requestData?: (this: RunConfig, data: any) => undefined | any;
        onreadystatechange?: XHREventHandler | Meta<XHREventHandler>;
        error?: XHREventHandler | Meta<XHREventHandler>;
        //timeout?: XHREventHandler | Meta<XHREventHandler>;
        loadstart?: XHREventHandler | Meta<XHREventHandler>;
        loadend?: XHREventHandler | Meta<XHREventHandler>;
        load?: XHREventHandler | Meta<XHREventHandler>;

        // response handlers and status code mapping
        responseData?: ((this: RunConfig, data: any, xhr: XHR) => T | undefined) | Meta<Function>;
        failure?: ((this: RunConfig, status: number, xhr: XHR) => any) | Meta<Function>;
    }
    interface StatusCodeMapping {
        // status code mapping and mapping handlers
        [statusCode: number]: number | ((xhr: XHR) => number) | Meta<number> | Meta<Function>;
    }
    export type InputConfig = InputConfigBase & StatusCodeMapping & {
        Children?: {
            [sub: string]: InputConfig | Meta<InputConfig>;
        };
        Properties?: {
            [custom: string]: any | Meta<any>;
        };
    };
    export type Retry = boolean | {
        wait?: number;
        limit?: number;
    };
    export type Throttle = {
        key: string,
        ms: number
    };
    export type Follows = string | {
        source: Requester | Promiser;
        path: string;
    };
    export type Timeout = number | XHREventHandler;
    export interface Meta<T> {
        name?: string;
        fullname?: string;
        value: T;
        private?: boolean;
        root?: boolean;
    }

    // one per Requester (structured)
    interface MetaConfigBase {
        name: string;

        // internals
        _fn: Requester;
        _parent: MetaConfig | null;
    }
    //TODO: find way to declare only Meta<T> versions from InputConfig
    export type MetaConfig = MetaConfigBase & InputConfig;

    // one per call (flattened, filled, and called)
    interface RunConfigBase {
        _args: [any];
        data: [any] | {};
        _singletonResult?: T;
    }
    export type RunConfig = RunConfigBase & MetaConfig;

    const version: string;

    function xhr(cfg: RunConfig): XHRPromise;
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
        function method(cfg: RunConfig): string;
        function url(cfg: RunConfig): string;
        function key(cfg: RunConfig): string;
        function cache(xhr: XHR): XHR;
        function remember(stage: string, xhr: XHR, cfg: RunConfig, data: any): void;

        // override at your own risk
        function promise(xhr: XHR, cfg: RunConfig): Promise<T>;
        function main(cfg: RunConfig): XHRPromise;
        function config(xhr: XHR, cfg: RunConfig): void;
        function retry(cfg: RunConfig, retry: boolean | {}, events: {}, fail: (e: Event) => void): void;
        function throttle(xhr: XHR, cfg: RunConfig, events: {}, fail: (e: Event) => void): void;
        const throttles: {
            [key: string]: {
                queue: number;
                lastRun: number;
            }
        };
        function run(xhr: XHR, cfg: RunConfig, events: {}, fail: (e: Event) => void): void;
        function load(cfg: RunConfig, resolve: (value: T) => void, reject: (error: any) => void): () => void;
        function forceJSONResponse(xhr: XHR): void;
        function data(cfg: RunConfig): any;
        function start(): void;
        function end(): void;
    }

    export type Promiser = (...input: any[]) => Promise<T>;
    interface RequesterBase extends InputConfigBase {
        cfg: MetaConfig;
        config(name: string, value?: any): any;
        extend(config: InputConfig, name?: string): Requester & {
            [Sub: string]: Requester
        };
    }
    type RequesterFn = (...requestData: any[]) => XHRPromise;
    export type Requester = RequesterFn & RequesterBase;
    export type Requirement = string | Requester | Promiser;

    function api(config: InputConfig, name?: string): Requester;
    namespace api {
        // building
        function build(config: InputConfig, parent: MetaConfig, name: string): Requester;
        function debug(name: string, fn: Requester): Requester;
        function setAll(cfg: InputConfig, config: MetaConfig): void;
        function set(cfg: MetaConfig, prop: string, value: any, parentName: string): void;
        function getter(fn: Requester, name: string): void;
        const meta: {
            chars: [string];
            _: (meta: Meta<any>, api?: Requester) => void;
            '!': (meta: Meta<any>, api?: Requester) => void;
            '@': (meta: Meta<any>, api?: Requester) => void;
        };

        // utility
        function get(cfg: MetaConfig, name: string, inheriting?: boolean): any;

        // user-facing (on all Requesters)
        function config(name: string, value: any): any;
        function extend(config: InputConfig, name: string): Requester & {
            [Sub: string]: Requester
        };

        // requesting
        function main(fn: Requester, args: [any]): XHRPromise | Promise<T>;
        function getAll(cfg: MetaConfig, inheriting?: boolean): RunConfig;
        function process(cfg: RunConfig): void;
        function promise(cfg: RunConfig, fn: Requester): XHRPromise | Promise<T>;
        function require(req: Requirement): Promise<T>;
        function follow(cfg: RunConfig, fn: Requester): XHRPromise | Promise<T>;

        // resolving/combining config values
        function resolve(string: string, data: [any] | {}, cfg: RunConfig, consume: boolean | undefined): string;
        function copy(to: RunConfig, from: MetaConfig): void;
        function log(args: [any], level: string): void;
        function combine(pval: any, val: any, cfg: RunConfig): any;
        function combineFn(pfn: Function, fn: Function): Function;
        function combineObject(pobj: {}, obj: {}): {};
        function type(val: any): string;
    }
}

declare function Posterior<T>(config?: Posterior.InputConfig, name?: string): Posterior.Requester;

export = Posterior;
