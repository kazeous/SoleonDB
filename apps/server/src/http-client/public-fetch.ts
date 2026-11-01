import {request as httpRequest,Agent as HttpAgent} from 'node:http';
import {request as httpsRequest,Agent as HttpsAgent} from 'node:https';
import type {RequestOptions} from 'node:https';
import type {ClientRequest,IncomingMessage} from 'node:http';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createGunzip,createInflate,createBrotliDecompress} from 'node:zlib';
import type {Readable} from 'node:stream';
import type {LookupFunction} from 'node:net';
import {parsePublicUrl,resolvePublicAddress} from './address-policy.js';
import type {PublicResolver,PublicAddress} from './address-policy.js';
export interface PublicFetchOptions{signal?:AbortSignal;maxBytes?:number;headers?:Record<string,string>;method?:'GET'|'POST';body?:string;trustedOrigins?:readonly string[]}
export interface PublicTextResponse{url:string;status:number;headers:Headers;text:string}
export class PublicFetchError extends Error{constructor(public readonly code:'url'|'address'|'redirect'|'credentials'|'size'|'timeout'|'cancelled'|'network',message:string){super(message);}}
export type PublicRequest=(url:URL,options:RequestOptions,callback:(response:IncomingMessage)=>void)=>ClientRequest;
const restricted=/authorization|cookie|token|secret|(?:^|-)key|client-id/i,forbidden=/^(?:host|connection|content-length|transfer-encoding|upgrade|proxy-authorization|proxy-connection|te|trailer)$/i;
const safeRedirectHeaders=new Set(['accept','accept-language','accept-encoding','user-agent']);
function headersFor(options:PublicFetchOptions,url:URL):Record<string,string>{const headers:Record<string,string>={'user-agent':'Eousbot/1.0 (Discord community bot)','accept-encoding':'gzip, deflate, br',accept:'application/json, application/rss+xml, application/atom+xml, application/xml, text/plain;q=0.9'};let size=0;for(const [name,value] of Object.entries(options.headers??{})){const key=name.toLowerCase();if(forbidden.test(key)||!/^[a-z0-9!#$%&'*+.^_`|~-]+$/.test(key)||/[\r\n]/.test(value))throw new PublicFetchError('credentials','Unsupported HTTP request header');size+=key.length+value.length;if(size>16384)throw new PublicFetchError('size','Request headers exceed the limit');headers[key]=value;}
 if(options.body!==undefined&&options.method!=='POST')throw new PublicFetchError('credentials','Request bodies require an explicit POST provider request');
 const authenticated=Object.keys(headers).some(name=>restricted.test(name))||options.method==='POST';if(authenticated&&url.protocol!=='https:')throw new PublicFetchError('credentials','Authenticated provider requests require HTTPS');
 if(authenticated&&!options.trustedOrigins?.includes(url.origin))throw new PublicFetchError('credentials','Explicit trusted provider origin is required');return headers;}
function responseHeaders(response:IncomingMessage){const result=new Headers();for(const [name,value] of Object.entries(response.headers))if(value!==undefined)for(const item of Array.isArray(value)?value:[String(value)])result.append(name,item);return result;}
function pinnedLookup(address:PublicAddress):LookupFunction{return ((_hostname:string,options:unknown,callback:(...args:unknown[])=>void)=>{if(options&&typeof options==='object'&&'all'in options&&options.all)callback(null,[address]);else callback(null,address.address,address.family);}) as LookupFunction;}
async function requestOnce(url:URL,address:PublicAddress,headers:Record<string,string>,method:'GET'|'POST',body:string|undefined,signal:AbortSignal,request?:PublicRequest):Promise<IncomingMessage>{
 signal.throwIfAborted();return new Promise((resolve,reject)=>{
  const options:RequestOptions={method,headers,lookup:pinnedLookup(address),agent:url.protocol==='https:'?new HttpsAgent({keepAlive:false}):new HttpAgent({keepAlive:false}),rejectUnauthorized:true,...(!isIP(url.hostname.replace(/^\[|\]$/g,''))?{servername:url.hostname}:{}),maxHeaderSize:16384};
  let outgoing:ClientRequest;try{outgoing=(request??(url.protocol==='https:'?httpsRequest:httpRequest))(url,options,response=>{response.once('error',reject);if(signal.aborted){response.destroy();reject(signal.reason);}else resolve(response);});}catch{reject(new PublicFetchError('network','Public HTTP request failed'));return;}
  const aborted=()=>outgoing.destroy(signal.reason instanceof Error?signal.reason:new PublicFetchError('cancelled','Request cancelled'));signal.addEventListener('abort',aborted,{once:true});outgoing.once('close',()=>signal.removeEventListener('abort',aborted));outgoing.once('error',reject);if(signal.aborted)aborted();else outgoing.end(body);
 });
}
async function readBounded(response:IncomingMessage,headers:Headers,maxBytes:number,signal:AbortSignal):Promise<string>{
 const length=Number(headers.get('content-length'));if(Number.isFinite(length)&&length>maxBytes){response.destroy();throw new PublicFetchError('size','Response exceeds the byte limit');}
 const encoding=headers.get('content-encoding')?.trim().toLowerCase()??'identity';let body:Readable=response;
 if(encoding==='gzip'||encoding==='x-gzip')body=response.pipe(createGunzip());else if(encoding==='deflate')body=response.pipe(createInflate());else if(encoding==='br')body=response.pipe(createBrotliDecompress());else if(encoding!==''&&encoding!=='identity'){response.destroy();throw new PublicFetchError('network','Unsupported response encoding');}
 const forwardError=(error:Error)=>{if(body!==response)body.destroy(error);},abort=()=>body.destroy(signal.reason instanceof Error?signal.reason:new PublicFetchError('cancelled','Request cancelled'));response.on('error',forwardError);signal.addEventListener('abort',abort,{once:true});
 const chunks:Buffer[]=[];let total=0;try{signal.throwIfAborted();for await(const chunk of body){signal.throwIfAborted();const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as Uint8Array);total+=buffer.length;if(total>maxBytes)throw new PublicFetchError('size','Decompressed response exceeds the byte limit');chunks.push(buffer);}return Buffer.concat(chunks,total).toString('utf8');}finally{signal.removeEventListener('abort',abort);response.removeListener('error',forwardError);if(body!==response)body.destroy();response.destroy();}
}
export function createPublicTextFetcher(deps:{resolve?:PublicResolver;request?:PublicRequest;timeoutMs?:number}={}){
 const resolve=deps.resolve??(async(hostname:string)=>lookup(hostname,{all:true,verbatim:true})),timeoutMs=deps.timeoutMs??15000;
 return async(input:string,options:PublicFetchOptions={}):Promise<PublicTextResponse>=>{
  const controller=new AbortController(),signal=controller.signal,maxBytes=options.maxBytes??2097152;let rejectAbort:(reason:unknown)=>void=()=>{};const aborted=new Promise<never>((_resolve,reject)=>{rejectAbort=reject;});signal.addEventListener('abort',()=>rejectAbort(signal.reason),{once:true});const timer=setTimeout(()=>controller.abort(new PublicFetchError('timeout','Public HTTP request deadline exceeded')),timeoutMs),parentAbort=()=>controller.abort(new PublicFetchError('cancelled','Public HTTP request cancelled'));options.signal?.addEventListener('abort',parentAbort,{once:true});if(options.signal?.aborted)parentAbort();
  const run=async():Promise<PublicTextResponse>=>{
   if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>16777216)throw new PublicFetchError('size','Invalid response byte limit');if(options.body!==undefined&&Buffer.byteLength(options.body)>2097152)throw new PublicFetchError('size','Request body exceeds the byte limit');
   let url:URL;try{url=parsePublicUrl(input);}catch{throw new PublicFetchError('url','Only public credential-free HTTP destinations are allowed');}let headers=headersFor(options,url),method=options.method??'GET',body=options.body;const visited=new Set<string>();
   for(let redirects=0;;redirects++){
    signal.throwIfAborted();if(visited.has(url.href))throw new PublicFetchError('redirect','HTTP redirect loop detected');visited.add(url.href);let address:PublicAddress;try{address=await resolvePublicAddress(url,resolve);}catch{throw new PublicFetchError('address','Destination did not resolve exclusively to public addresses');}signal.throwIfAborted();const response=await requestOnce(url,address,headers,method,body,signal,deps.request),received=responseHeaders(response),status=response.statusCode;if(status===undefined){response.destroy();throw new PublicFetchError('network','HTTP response status unavailable');}
    if([301,302,303,307,308].includes(status)){
     response.destroy();if(redirects>=5)throw new PublicFetchError('redirect','HTTP redirect limit exceeded');const location=received.get('location');if(!location)throw new PublicFetchError('redirect','HTTP redirect location unavailable');let next:URL;try{next=parsePublicUrl(new URL(location,url).href);}catch{throw new PublicFetchError('redirect','Redirect destination is not an allowed public HTTP URL');}
     if(next.origin!==url.origin){if(method==='POST'&&body&&[307,308].includes(status))throw new PublicFetchError('redirect','Cross-origin request-body redirects are not allowed');headers=Object.fromEntries(Object.entries(headers).filter(([name])=>safeRedirectHeaders.has(name)));}
     if(status===303||method==='POST'&&[301,302].includes(status)){method='GET';body=undefined;delete headers['content-type'];}url=next;continue;
    }
    const text=await readBounded(response,received,maxBytes,signal);return {url:url.href,status,headers:received,text};
   }
  };
  try{return await Promise.race([run(),aborted]);}catch(error){if(signal.aborted)throw signal.reason;if(error instanceof PublicFetchError)throw error;throw new PublicFetchError('network','Public HTTP request failed');}finally{clearTimeout(timer);options.signal?.removeEventListener('abort',parentAbort);}
 };
}
export const fetchPublicText=createPublicTextFetcher();
