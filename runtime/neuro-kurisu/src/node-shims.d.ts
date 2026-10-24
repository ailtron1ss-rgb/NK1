declare module 'node:crypto' { export function randomUUID(): string;
  export function createHash(algorithm: string): { update(data: string | Uint8Array): any; digest(encoding: string): string }; export function verify(algorithm: null | string, data: Uint8Array, key: string, signature: Uint8Array): boolean; export function sign(algorithm: null | string, data: Uint8Array, key: string): any; export function createPublicKey(key:any):any; export function createPrivateKey(key:any):any; export function randomBytes(size:number):Buffer; export function timingSafeEqual(a:Uint8Array,b:Uint8Array):boolean; }
declare module 'node:fs/promises' {
  export function access(path:string): Promise<void>;
  export function appendFile(path:string,data:string,encoding?:string):Promise<void>;
  export function copyFile(src:string,dest:string):Promise<void>;
  export function mkdir(path:string, options?:{recursive?:boolean;mode?:number}):Promise<string|undefined>;
  export function open(path:string, flags:string, mode?:number):Promise<any>;
  export function readFile(path:string, encoding:'utf8'):Promise<string>;
  export function readFile(path:string):Promise<Uint8Array>;
  export function rename(src:string,dest:string):Promise<void>;
  export function rm(path:string, options?:{recursive?:boolean;force?:boolean}):Promise<void>;
  export function stat(path:string):Promise<any>;
  export function unlink(path:string):Promise<void>;
  export function link(existingPath:string,newPath:string):Promise<void>;
  export function writeFile(path:string,data:string,encoding:'utf8'):Promise<void>;
  export function mkdtemp(prefix:string):Promise<string>;
  export function realpath(path:string):Promise<string>;
  export function lstat(path:string):Promise<any>;
  export function readFile(path:string, options:string|{encoding?:string}):Promise<string|Uint8Array>;
  export function writeFile(path:string,data:string|Uint8Array,options?:string|{encoding?:string;mode?:number;flag?:string}):Promise<void>;
}
declare module 'node:fs' { export function closeSync(fd:number):void; export function fsyncSync(fd:number):void; export function mkdirSync(path:string,options?:{recursive?:boolean;mode?:number}):string|undefined; export function openSync(path:string,flags:string,mode?:number):number; export function readFileSync(path:string,options?:string|{encoding?:string}):string|Uint8Array; export function renameSync(src:string,dest:string):void; export function unlinkSync(path:string):void; export function writeFileSync(path:string,data:string|Uint8Array,options?:string|{encoding?:string;mode?:number;flag?:string}):void; export function appendFileSync(path:string,data:string,options?:string|{encoding?:string}):void; export function existsSync(path:string):boolean; export function readdirSync(path:string,options?:any):any[]; export function lstatSync(path:string):any; export function realpathSync(path:string):string; export function statSync(path:string):any; export function mkdtempSync(prefix:string):string; }
declare module 'node:path' { const path: { join(...parts:string[]):string; resolve(...parts:string[]):string; relative(from:string,to:string):string; dirname(path:string):string; basename(path:string):string; isAbsolute(path:string):boolean; sep:string; }; export default path; export const sep:string; export function resolve(...parts:string[]):string; export function relative(from:string,to:string):string; export function dirname(path:string):string; export function join(...parts:string[]):string; export function basename(path:string):string; export function isAbsolute(path:string):boolean; }
declare module 'node:os' { export function homedir():string; export function tmpdir():string; export function totalmem():number; export function freemem():number; export function loadavg():number[]; export function cpus():any[]; export function hostname():string; }
declare module 'node:http' { export function createServer(handler:(req:any,res:any)=>void):any; }
declare module 'node:child_process' { export interface ChildProcessLike { on(event:'error',handler:(error:Error)=>void):any; on(event:'close',handler:(code:number|null,signal:string|null)=>void):any; on(event:'exit',handler:(code:number|null,signal:string|null)=>void):any; stdout:any; stderr:any; pid?:number; kill(signal?:string):boolean; } export function spawn(command:string,args?:string[],options?:any):ChildProcessLike; export function execFile(command:string,args?:string[],options?:any,callback?:any):any; }
declare module 'node:util' { export function promisify(fn:any):any; }
declare namespace NodeJS { type Signals=string; interface ErrnoException extends Error { code?:string; errno?:number; syscall?:string; path?:string; } interface Timeout { unref():this; ref():this; hasRef():boolean; } interface ProcessEnv { [key:string]:string|undefined; } }
declare var process: { pid:number; env:Record<string,string|undefined>; argv:string[]; platform:string; cwd():string; execPath:string; version:string; versions:Record<string,string>; exitCode?:number; on(event:string,handler:(...args:any[])=>void):void; memoryUsage():{rss:number;heapUsed:number;heapTotal:number;external:number;arrayBuffers?:number}; kill(pid:number|string,signal?:number|string):void; }

declare module 'node:zlib' { export function deflateRawSync(data: Uint8Array): Uint8Array; export function inflateRawSync(data: Uint8Array): Uint8Array; }
declare module 'node:v8' { export function serialize(value: unknown): Uint8Array; export function deserialize(data: Uint8Array): unknown; }

declare module 'node:dns/promises' { export function lookup(hostname:string, options?:{all?:boolean;verbatim?:boolean}):Promise<any>; }
declare module 'node:net' { export function isIP(input:string):number; }
declare module 'node:https' { export type RequestOptions = { lookup?: any; [key:string]: any }; export function request(options:any, callback:(response:any)=>void):any; }
declare class Buffer extends Uint8Array { static isBuffer(value:unknown):value is Buffer; static from(value:string|Uint8Array|ArrayBuffer|ArrayBufferView|readonly number[],encoding?:string):Buffer; static concat(list:readonly Uint8Array[],totalLength?:number):Buffer; static alloc(size:number,fill?:string|number|Uint8Array):Buffer; static byteLength(value:string|Uint8Array,encoding?:string):number; toString(encoding?:string,start?:number,end?:number):string; }
declare function setTimeout(callback:(...args:any[])=>void,ms?:number,...args:any[]):NodeJS.Timeout;
declare function clearTimeout(timeoutId:number|NodeJS.Timeout):void;
