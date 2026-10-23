declare module 'node:crypto' {
  export function randomUUID(): string;
  export function createHash(algorithm: string): { update(data: string | Uint8Array): any; digest(encoding: string): string };
  export function createPublicKey(key: unknown): any;
  export function verify(algorithm: null | string, data: Uint8Array, key: unknown, signature: Uint8Array): boolean;
  export function sign(algorithm: null | string, data: Uint8Array, key: unknown): any;
}
declare module 'node:fs/promises' {
  export function access(path:string, mode?:number): Promise<void>;
  export function appendFile(path:string,data:string|Uint8Array,encoding?:string):Promise<void>;
  export function copyFile(src:string,dest:string,mode?:number):Promise<void>;
  export function mkdir(path:string, options?:{recursive?:boolean;mode?:number}):Promise<string|undefined>;
  export function open(path:string, flags:string, mode?:number):Promise<any>;
  export function readFile(path:string, encoding:'utf8'|{encoding:'utf8';flag?:string}):Promise<string>;
  export function readFile(path:string):Promise<Uint8Array>;
  export function realpath(path:string):Promise<string>;
  export function rename(src:string,dest:string):Promise<void>;
  export function rm(path:string, options?:{recursive?:boolean;force?:boolean}):Promise<void>;
  export function stat(path:string):Promise<any>;
  export function lstat(path:string):Promise<any>;
  export function unlink(path:string):Promise<void>;
  export function link(existingPath:string,newPath:string):Promise<void>;
  export function writeFile(path:string,data:string|Uint8Array,options:'utf8'|{encoding?:'utf8';mode?:number;flag?:string}):Promise<void>;
  export function mkdtemp(prefix:string):Promise<string>;
}
declare module 'node:fs' {
  export const constants: { [name:string]: number; F_OK:number; R_OK:number; W_OK:number; X_OK:number; O_RDONLY:number; O_WRONLY:number; O_RDWR:number; O_CREAT:number; O_EXCL:number; O_NOFOLLOW:number; };
  export function closeSync(fd:number):void;
  export function fsyncSync(fd:number):void;
  export function linkSync(existingPath:string,newPath:string):void;
  export function mkdirSync(path:string,options?:{recursive?:boolean;mode?:number}):string|undefined;
  export function openSync(path:string,flags:string,mode?:number):number;
  export function readFileSync(path:string,encoding:'utf8'):string;
  export function readFileSync(path:string):Buffer;
  export function renameSync(oldPath:string,newPath:string):void;
  export function unlinkSync(path:string):void;
  export function writeFileSync(pathOrFd:string|number,data:string|Uint8Array,options?:string|{encoding?:string;mode?:number;flag?:string}):void;
  export function existsSync(path:string):boolean;
  export function readdirSync(path:string):string[];
  export function statSync(path:string):any;
  export function lstatSync(path:string):any;
  export function rmSync(path:string,options?:{recursive?:boolean;force?:boolean}):void;
}
declare module 'node:path' {
  const path: {
    join(...parts:string[]):string; resolve(...parts:string[]):string; relative(from:string,to:string):string;
    dirname(path:string):string; basename(path:string,suffix?:string):string; isAbsolute(path:string):boolean;
    normalize(path:string):string; extname(path:string):string; sep:string; delimiter:string;
  };
  export default path;
  export function dirname(path:string):string;
  export function join(...parts:string[]):string;
  export function resolve(...parts:string[]):string;
  export function relative(from:string,to:string):string;
  export function basename(path:string,suffix?:string):string;
  export function isAbsolute(path:string):boolean;
  export function normalize(path:string):string;
  export function extname(path:string):string;
  export const sep:string;
  export const delimiter:string;
}
declare module 'node:os' {
  export function homedir():string; export function tmpdir():string; export function totalmem():number;
  export function freemem():number; export function loadavg():number[]; export function cpus():any[];
  export function hostname():string;
}
declare module 'node:http' { export function createServer(handler:(req:any,res:any)=>void):any; }
declare module 'node:child_process' {
  export interface ChildProcessLike {
    pid?:number;
    stdout:{on(event:'data',handler:(chunk:Buffer)=>void):void};
    stderr:{on(event:'data',handler:(chunk:Buffer)=>void):void};
    kill(signal?:string):boolean;
    once(event:string,handler:(...args:any[])=>void):this;
  }
  export function spawn(command:string,args?:string[],options?:any):ChildProcessLike;
  export function execFile(command:string,args?:string[],options?:any,callback?:any):any;
}
declare module 'node:util' { export function promisify(fn:any):any; }
declare namespace NodeJS {
  interface ProcessEnv { [key:string]: string|undefined; }
  interface ErrnoException extends Error { errno?:number; code?:string; path?:string; syscall?:string; }
  interface Timeout { ref():this; unref():this; }
  type Signals = string;
}
declare const process: {
  pid:number; platform:string; env:NodeJS.ProcessEnv; argv:string[]; exitCode?:number;
  cwd():string; execPath:string; versions:Record<string,string>;
  on(event:string,handler:(...args:any[])=>void):void;
  memoryUsage():{rss:number;heapUsed:number;heapTotal:number;external:number;arrayBuffers?:number};
  kill(pid:number|string,signal?:number|string):void;
}
declare module 'node:zlib' {
  export function deflateRawSync(data: Uint8Array): Uint8Array;
  export function inflateRawSync(data: Uint8Array): Uint8Array;
}
declare module 'node:v8' { export function serialize(value: unknown): Uint8Array; export function deserialize(data: Uint8Array): unknown; }
declare module 'node:dns/promises' { export function lookup(hostname:string, options?:{all?:boolean;verbatim?:boolean}):Promise<any>; }
declare module 'node:net' { export function isIP(input:string):number; }
declare module 'node:https' {
  export type RequestOptions = { lookup?: any; [key:string]: any };
  export function request(options:any, callback:(response:any)=>void):any;
}
declare class Buffer extends Uint8Array {
  static isBuffer(value:unknown):boolean;
  static from(value:string|Uint8Array,encoding?:string):Buffer;
  static concat(list:readonly Uint8Array[],totalLength?:number):Buffer;
  static alloc(size:number,fill?:number|string|Uint8Array):Buffer;
  static allocUnsafe(size:number):Buffer;
  static byteLength(value:string,encoding?:string):number;
  toString(encoding?:string,start?:number,end?:number):string;
  subarray(begin?:number,end?:number):Buffer;
  write(value:string,offset?:number,encoding?:string):number;
}
