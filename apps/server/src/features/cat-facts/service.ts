import {toUSVString} from 'node:util';
import {AppError} from '../../core/errors.js';
import type {fetchPublicText} from '../../http-client/public-fetch.js';
export async function getCatFact(fetcher:typeof fetchPublicText):Promise<string>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{const response=await Promise.race([fetcher('https://catfact.ninja/fact',{signal:controller.signal,maxBytes:16384}),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Deadline'));},15000);})]);if(response.status!==200)throw new Error('Provider unavailable');const payload:unknown=JSON.parse(response.text);if(!payload||typeof payload!=='object'||!('fact' in payload)||typeof payload.fact!=='string'||!payload.fact.trim())throw new Error('Invalid fact');return toUSVString(payload.fact.trim().replaceAll('@','@\u200b').slice(0,1900).replace(/[\uD800-\uDBFF]$/,''));}
 catch{throw new AppError('unavailable','Cat fact provider is unavailable. Please try again later.');}finally{if(timer)clearTimeout(timer);}
}
