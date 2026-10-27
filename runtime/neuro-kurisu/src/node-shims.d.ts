declare module 'node:crypto' { export function randomUUID(): string;
  export function createHash(algorithm: string): { update(data: string | Uint8Array): any; digest(encoding: string): string }; export function verify(algorithm: null | string, data: Uint8Array, key: string, signature: Uint8Array): boolean; export function sign(algorithm: null | string, data: Uint8Array, key: string): any; }
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
}
declare module 'node:path' { const path: { join(...parts:string[]):string; dirname(path:string):string; basename(path:string):string; isAbsolute(path:string):boolean; }; export default path; export function dirname(path:string):string; export function join(...parts:string[]):string; export function basename(path:string):string; export function isAbsolute(path:string):boolean; }
declare module 'node:os' { export function homedir():string; export function tmpdir():string; export function totalmem():number; export function freemem():number; export function loadavg():number[]; export function cpus():any[]; export function hostname():string; }
declare module 'node:http' { export function createServer(handler:(req:any,res:any)=>void):any; }
declare module 'node:child_process' { export function spawn(command:string,args?:string[],options?:any):any; export function execFile(command:string,args?:string[],options?:any,callback?:any):any; }
declare module 'node:util' { export function promisify(fn:any):any; }

declare module 'node:zlib' { export function deflateRawSync(data: Uint8Array): Uint8Array; export function inflateRawSync(data: Uint8Array): Uint8Array; }
declare module 'node:v8' { export function serialize(value: unknown): Uint8Array; export function deserialize(data: Uint8Array): unknown; }

declare module 'node:dns/promises' { export function lookup(hostname:string, options?:{all?:boolean;verbatim?:boolean}):Promise<any>; }
declare module 'node:net' { export function isIP(input:string):number; }
declare module 'node:https' { export type RequestOptions = { lookup?: any; [key:string]: any }; export function request(options:any, callback:(response:any)=>void):any; }
