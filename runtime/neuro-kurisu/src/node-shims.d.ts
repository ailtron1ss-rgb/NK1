declare module 'node:fs' {
  export function existsSync(path:string):boolean;
  export function lstatSync(path:string):any;
  export function statSync(path:string):any;
  export function mkdirSync(path:string, options?:{recursive?:boolean;mode?:number}):void;
  export function openSync(path:string, flags:string, mode?:number):number;
  export function readFileSync(path:string, encoding:'utf8'):string;
  export function readFileSync(path:string):Uint8Array;
  export function writeFileSync(path:string, data:string|Uint8Array, options?:'utf8'|{encoding?:string;mode?:number;flag?:string}):void;
  export function writeSync(fd:number, data:string|Uint8Array):number;
  export function fsyncSync(fd:number):void;
  export function closeSync(fd:number):void;
  export function renameSync(from:string,to:string):void;
  export function unlinkSync(path:string):void;
  export function mkdtempSync(prefix:string):string;
}
declare namespace NodeJS {
  interface ErrnoException extends Error { code?: string; errno?: number; path?: string; syscall?: string; }
}
declare module 'node:crypto' {
  export function randomUUID(): string;
  export function createPublicKey(key: string | Uint8Array): { asymmetricKeyType?: string };
  export function createHash(algorithm: string): { update(data: string | Uint8Array): any; digest(encoding: string): string };
  export function verify(algorithm: null | string, data: Uint8Array, key: string, signature: Uint8Array): boolean;
  export function sign(algorithm: null | string, data: Uint8Array, key: string): any;
}
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
  export function lstat(path:string):Promise<any>;
  export function unlink(path:string):Promise<void>;
  export function link(existingPath:string,newPath:string):Promise<void>;
  export function writeFile(path:string,data:string,encoding:'utf8'):Promise<void>;
  export function mkdtemp(prefix:string):Promise<string>;
}
declare module 'node:path' {
  const path: { join(...parts:string[]):string; dirname(path:string):string; basename(path:string):string; isAbsolute(path:string):boolean; resolve(...parts:string[]):string; };
  export default path;
  export function dirname(path:string):string;
  export function join(...parts:string[]):string;
  export function basename(path:string):string;
  export function isAbsolute(path:string):boolean;
  export function resolve(...parts:string[]):string;
}
declare module 'node:os' { export function homedir():string; export function tmpdir():string; export function totalmem():number; export function freemem():number; export function loadavg():number[]; export function cpus():any[]; export function hostname():string; }
declare module 'node:http' { export function createServer(handler:(req:any,res:any)=>void):any; }
declare module 'node:child_process' { export function spawn(command:string,args?:string[],options?:any):any; export function execFile(command:string,args?:string[],options?:any,callback?:any):any; }
declare module 'node:util' { export function promisify(fn:any):any; }
declare const process: { pid:number; env:Record<string,string|undefined>; argv:string[]; exitCode?:number; on(event:string,handler:()=>void):void; memoryUsage():{rss:number;heapUsed:number;heapTotal:number;external:number;arrayBuffers?:number}; kill(pid:number|string,signal?:number|string):void; }

declare module 'node:zlib' { export function deflateRawSync(data: Uint8Array): Uint8Array; export function inflateRawSync(data: Uint8Array): Uint8Array; }
declare module 'node:v8' { export function serialize(value: unknown): Uint8Array; export function deserialize(data: Uint8Array): unknown; }

declare module 'node:dns/promises' { export function lookup(hostname:string, options?:{all?:boolean;verbatim?:boolean}):Promise<any>; }
declare module 'node:net' { export function isIP(input:string):number; }
declare module 'node:https' { export type RequestOptions = { lookup?: any; [key:string]: any }; export function request(options:any, callback:(response:any)=>void):any; }
declare const Buffer: {
  isBuffer(value:unknown):boolean;
  from(value:string|Uint8Array, encoding?:string):any;
  concat(list:readonly Uint8Array[], totalLength?:number):Uint8Array;
  byteLength(value:string|Uint8Array, encoding?:string):number;
};
