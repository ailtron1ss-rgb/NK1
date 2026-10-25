declare module 'node:crypto' {
  export function randomUUID(): string;
  export function createHash(algorithm: string): { update(data: string | Uint8Array): any; digest(encoding: string): string };
  export function createPublicKey(key: unknown): any;
  export function verify(algorithm: null | string, data: Uint8Array, key: string | unknown, signature: Uint8Array): boolean;
  export function sign(algorithm: null | string, data: Uint8Array, key: string | unknown): any;
}
declare module 'node:fs/promises' {
  export function access(path:string, mode?:number): Promise<void>;
  export function appendFile(path:string,data:string|Uint8Array, options?:string|{encoding?:string;mode?:number;flag?:string}):Promise<void>;
  export function copyFile(src:string,dest:string,mode?:number):Promise<void>;
  export function mkdir(path:string, options?:{recursive?:boolean;mode?:number}):Promise<string|undefined>;
  export function open(path:string, flags:string, mode?:number):Promise<any>;
  export function readFile(path:string, encoding:'utf8'|{encoding:'utf8'}):Promise<string>;
  export function readFile(path:string):Promise<Uint8Array>;
  export function realpath(path:string, options?:string|{encoding?:string}):Promise<string>;
  export function lstat(path:string):Promise<any>;
  export function rename(src:string,dest:string):Promise<void>;
  export function rm(path:string, options?:{recursive?:boolean;force?:boolean}):Promise<void>;
  export function stat(path:string):Promise<any>;
  export function unlink(path:string):Promise<void>;
  export function link(existingPath:string,newPath:string):Promise<void>;
  export function writeFile(path:string,data:string|Uint8Array,options?:'utf8'|{encoding?:string;mode?:number;flag?:string}):Promise<void>;
  export function mkdtemp(prefix:string):Promise<string>;
}
declare module 'node:path' { const path: { join(...parts:string[]):string; dirname(path:string):string; basename(path:string):string; isAbsolute(path:string):boolean; resolve(...parts:string[]):string; sep:string; }; export default path; export function dirname(path:string):string; export function join(...parts:string[]):string; export function basename(path:string):string; export function isAbsolute(path:string):boolean; export function resolve(...parts:string[]):string; export const sep:string; }
declare module 'node:os' { export function homedir():string; export function tmpdir():string; export function totalmem():number; export function freemem():number; export function loadavg():number[]; export function cpus():any[]; export function hostname():string; }
declare module 'node:http' { export function createServer(handler:(req:any,res:any)=>void):any; }
declare module 'node:child_process' {
  export interface StreamLike { on(event:string, listener:(chunk:any)=>void): this; }
  export interface ChildProcessLike {
    pid?:number; stdout:StreamLike; stderr:StreamLike;
    on(event:'error', listener:(error:Error)=>void):this;
    on(event:'close', listener:(code:number|null, signal:string|null)=>void):this;
    on(event:'exit', listener:(code:number|null, signal:string|null)=>void):this;
    on(event:string, listener:(...args:any[])=>void):this;
    once(event:'error', listener:(error:Error)=>void):this;
    once(event:'close', listener:(code:number|null, signal:string|null)=>void):this;
    once(event:'exit', listener:(code:number|null, signal:string|null)=>void):this;
    once(event:string, listener:(...args:any[])=>void):this;
    kill(signal?:string):boolean;
  }
  export function spawn(command:string,args?:string[],options?:any):ChildProcessLike;
  export function execFile(command:string,args?:string[],options?:any,callback?:((error:Error|null,stdout:string|Uint8Array,stderr:string|Uint8Array)=>void)|any):ChildProcessLike;
}
declare module 'node:util' { export function promisify(fn:any):any; }
declare const process: { pid:number; platform:string; env:Record<string,string|undefined>; argv:string[]; exitCode?:number; on(event:string,handler:(...args:any[])=>void):void; memoryUsage():{rss:number;heapUsed:number;heapTotal:number;external:number;arrayBuffers?:number}; kill(pid:number|string,signal?:number|string):boolean; }

declare module 'node:zlib' { export function deflateRawSync(data: Uint8Array): Uint8Array; export function inflateRawSync(data: Uint8Array): Uint8Array; }
declare module 'node:v8' { export function serialize(value: unknown): Uint8Array; export function deserialize(data: Uint8Array): unknown; }

declare module 'node:dns/promises' { export function lookup(hostname:string, options?:{all?:boolean;verbatim?:boolean}):Promise<any>; }
declare module 'node:net' { export function isIP(input:string):number; }
declare module 'node:https' { export type RequestOptions = { lookup?: any; [key:string]: any }; export function request(options:any, callback:(response:any)=>void):any; }
interface Buffer extends Uint8Array { toString(encoding?:string):string; }
declare const Buffer: { isBuffer(value:unknown):value is Buffer; from(value:string|Uint8Array|ArrayBuffer, encoding?:string):Buffer; concat(list:readonly Uint8Array[], totalLength?:number):Buffer; alloc(size:number, fill?:string|number|Uint8Array, encoding?:string):Buffer; byteLength(value:string|ArrayBuffer|ArrayBufferView, encoding?:string):number; };

declare module 'node:fs' {
  export function closeSync(fd:number):void;
  export function existsSync(path:string):boolean;
  export function fsyncSync(fd:number):void;
  export function linkSync(existingPath:string,newPath:string):void;
  export function lstatSync(path:string):any;
  export function mkdirSync(path:string,options?:{recursive?:boolean;mode?:number}):string|undefined;
  export function mkdtempSync(prefix:string):string;
  export function openSync(path:string,flags:string,mode?:number):number;
  export function readFileSync(path:string,encoding:'utf8'):string;
  export function readFileSync(path:string,options?:{encoding:'utf8';flag?:string}):string;
  export function readFileSync(path:string):Buffer;
  export function readdirSync(path:string,options?:{withFileTypes?:boolean}):any[];
  export function realpathSync(path:string):string;
  export function renameSync(oldPath:string,newPath:string):void;
  export function statSync(path:string):any;
  export function unlinkSync(path:string):void;
  export function writeFileSync(fd:number,data:string|Uint8Array):void;
  export function writeFileSync(path:string,data:string|Uint8Array,options?:'utf8'|{encoding?:string;mode?:number;flag?:string}):void;
  export const constants: { F_OK:number; R_OK:number; W_OK:number; X_OK:number; [key:string]:number };
}
declare namespace NodeJS {
  interface ProcessEnv { [key:string]: string | undefined; }
  interface ErrnoException extends Error { errno?:number; code?:string; path?:string; syscall?:string; }
  interface Timeout { ref():this; unref():this; hasRef():boolean; refresh():this; }
}
declare function setTimeout(handler:(...args:any[])=>void, timeout?:number, ...args:any[]):NodeJS.Timeout;
declare function clearTimeout(timeout:NodeJS.Timeout|number):void;
declare function setInterval(handler:(...args:any[])=>void, timeout?:number, ...args:any[]):NodeJS.Timeout;
declare function clearInterval(timeout:NodeJS.Timeout|number):void;
