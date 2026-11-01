import {isIP} from 'node:net';
import ipaddr from 'ipaddr.js';
export interface PublicAddress{address:string;family:4|6}
export type PublicResolver=(hostname:string)=>Promise<Array<{address:string;family:number}>>;
export function isPublicAddress(input:string):boolean{try{if(!isIP(input))return false;return ipaddr.process(input).range()==='unicast';}catch{return false;}}
export function parsePublicUrl(input:string):URL{
 let url:URL;try{url=new URL(input);}catch{throw new Error('Invalid public HTTP URL');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Only credential-free HTTP URLs are allowed');
 const host=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
 if(!host||!host.includes('.')&&!isIP(host)||host==='localhost'||/\.(?:localhost|local|internal|lan|home|localdomain)$/.test(host))throw new Error('Local destinations are not allowed');
 if(isIP(host)&&!isPublicAddress(host))throw new Error('Private or reserved destinations are not allowed');
 url.hash='';return url;
}
export async function resolvePublicAddress(url:URL,resolve:PublicResolver):Promise<PublicAddress>{const host=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'');if(isIP(host))return {address:host,family:isIP(host) as 4|6};const addresses=await resolve(host);if(!addresses.length||addresses.some(item=>!isPublicAddress(item.address)||isIP(item.address)!==item.family))throw new Error('Private or reserved DNS results are not allowed');const first=addresses[0]!;return {address:first.address,family:first.family as 4|6};}
