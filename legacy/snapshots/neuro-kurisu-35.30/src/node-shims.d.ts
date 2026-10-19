declare module 'node:crypto' { export function randomUUID(): string;
  export function createHash(algorithm: string): { update(data: string | Uint8Array): any; digest(encoding: string): string }; }
declare module 'node:fs/promises' {
  export function access(path:string): Promise<void>;
  export function appendFile(path:string,data:string,encoding?:string):Promise<void>;
  export function copyFile(src:string,dest:string):Promise<void>;
  export function mkdir(path:string, options?:{recursive?:boolean}):Promise<string|undefined>;
  export function open(path:string, flags:string):Promise<any>;
  export function readFile(path:string, encoding:'utf8'):Promise<string>;
  export function readFile(path:string):Promise<Uint8Array>;
  export function rename(src:string,dest:string):Promise<void>;
  export function rm(path:string, options?:{recursive?:boolean;force?:boolean}):Promise<void>;
  export function stat(path:string):Promise<any>;
  export function unlink(path:string):Promise<void>;
  export function writeFile(path:string,data:string,encoding:'utf8'):Promise<void>;
  export function mkdtemp(prefix:string):Promise<string>;
}
declare module 'node:path' { const path: { join(...parts:string[]):string; dirname(path:string):string; }; export default path; export function dirname(path:string):string; export function join(...parts:string[]):string; }
declare module 'node:os' { export function tmpdir():string; export function totalmem():number; export function freemem():number; export function loadavg():number[]; export function cpus():any[]; export function hostname():string; }
declare module 'node:http' { export function createServer(handler:(req:any,res:any)=>void):any; }
declare module 'node:child_process' { export function spawn(command:string,args?:string[],options?:any):any; export function execFile(command:string,args?:string[],options?:any,callback?:any):any; }
declare module 'node:util' { export function promisify(fn:any):any; }
declare const process: { pid:number; env:Record<string,string|undefined>; argv:string[]; exitCode?:number; on(event:string,handler:()=>void):void; memoryUsage():{rss:number;heapUsed:number;heapTotal:number;external:number;arrayBuffers?:number}; kill(pid:number|string,signal?:number|string):void; }

declare module 'node:zlib' { export function deflateRawSync(data: Uint8Array): Uint8Array; export function inflateRawSync(data: Uint8Array): Uint8Array; }
