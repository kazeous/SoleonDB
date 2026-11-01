import {snowflakeSchema} from '@eousbot/contracts';
import type {VerificationBinding} from './repository.js';
import type {VerificationPort} from './ports.js';
export interface ReactionSnapshot {normal:Set<string>;burst:Set<string>}
export async function enumerateReactions(port:VerificationPort,binding:VerificationBinding):Promise<ReactionSnapshot>{
 const result:ReactionSnapshot={normal:new Set(),burst:new Set()};
 for(const type of ['normal','burst'] as const){let cursor:string|null=null;const seen=new Set<string>();
  for(let page=0;page<10000;page++){
   const next=await port.listReactors(binding,type,cursor);for(const id of next.userIds)result[type].add(snowflakeSchema.parse(id));
   if(next.nextCursor===null)break;
   if(page===9999||seen.has(next.nextCursor)||next.nextCursor===cursor)throw new Error('Incomplete reaction pagination');
   cursor=snowflakeSchema.parse(next.nextCursor);seen.add(cursor);
  }
 }
 return result;
}

