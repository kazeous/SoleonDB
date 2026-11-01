import type {AppDb} from '../../db/client.js';
import type {Clock} from '../../core/clock.js';
import type {FeatureStatusRegistry} from '../../core/status.js';
import {createSettingsService} from '../../guilds/settings.js';
import {createStarboardRepository} from './repository.js';
export interface StarboardSource{guildId:string;channelId:string;messageId:string;authorId:string;authorIsBot:boolean;authorName:string;avatarUrl:string|null;content:string;imageUrl:string|null;createdAt:number}
export interface StarboardPort{source(guildId:string,channelId:string,messageId:string):Promise<StarboardSource|null>;reactors(guildId:string,channelId:string,messageId:string,type:'normal'|'burst',cursor:string|null):Promise<{users:Array<{id:string;isBot:boolean}>;nextCursor:string|null}>;post(guildId:string,destinationId:string,operationId:string,source:StarboardSource,count:number):Promise<string>;findPost(guildId:string,destinationId:string,operationId:string):Promise<string|null>;edit(guildId:string,destinationId:string,messageId:string,source:StarboardSource,count:number,operationId:string):Promise<boolean>;remove(guildId:string,destinationId:string,messageId:string):Promise<void>}
export function createStarboardService(deps:{db:AppDb;clock:Clock;port:StarboardPort;status:FeatureStatusRegistry}){
 const {db,clock,port,status}=deps,settings=createSettingsService(db,clock),repository=createStarboardRepository(db,clock),queues=new Map<string,Promise<void>>();
 async function count(source:StarboardSource){const all=new Set<string>();for(const type of ['normal','burst'] as const){let cursor:string|null=null;const seen=new Set<string>();for(let page=0;;page++){if(page>=2500)throw new Error('Reaction enumeration exceeded bounded pages');const result=await port.reactors(source.guildId,source.channelId,source.messageId,type,cursor);for(const user of result.users)if(!user.isBot&&user.id!==source.authorId)all.add(user.id);if(result.nextCursor===null)break;if(seen.has(result.nextCursor))throw new Error('Reaction pagination incomplete');seen.add(result.nextCursor);cursor=result.nextCursor;}}return all.size;}
 async function sync(guildId:string,sourceChannelId:string,messageId:string):Promise<void>{
  const config=(await settings.read(guildId,'starboard')).value;if(!config.enabled||!config.channelId){status.set(guildId,'starboard','disabled');return;}if(sourceChannelId===config.channelId)return;
  await repository.ensure(guildId,sourceChannelId,messageId,config.channelId);if(!await repository.claim(guildId,messageId))return;
  try{
   const mapping=await repository.read(guildId,messageId);if(!mapping||mapping.sourceChannelId!==sourceChannelId)throw new Error('Starboard source binding mismatch');
   const source=mapping.sourceDeleted?null:await port.source(guildId,sourceChannelId,messageId);if(source&&(source.guildId!==guildId||source.channelId!==sourceChannelId||source.messageId!==messageId))throw new Error('Source guild mismatch');if(source?.authorIsBot)return;
   let repostId=mapping.repostId;if(!repostId&&['creating','unknown'].includes(mapping.state)){repostId=await port.findPost(guildId,mapping.destinationId,mapping.operationId);if(!repostId)throw new Error('Unconfirmed repost; no resend');await repository.posted(guildId,messageId,repostId,mapping.starCount);}
   if(!source){await repository.sourceDeleted(guildId,messageId);if(repostId)await port.remove(guildId,mapping.destinationId,repostId);await repository.removed(guildId,messageId);return;}
   const stars=await count(source);
   if(stars<config.threshold){if(repostId)await port.remove(guildId,mapping.destinationId,repostId);await repository.removed(guildId,messageId);status.set(guildId,'starboard','ready');return;}
   if(repostId&&mapping.destinationId!==config.channelId){await port.remove(guildId,mapping.destinationId,repostId);await repository.removed(guildId,messageId);repostId=null;}
   if(repostId){if(await port.edit(guildId,mapping.destinationId,repostId,source,stars,mapping.operationId)){await repository.posted(guildId,messageId,repostId,stars);status.set(guildId,'starboard','ready');return;}await repository.removed(guildId,messageId);}
   const operationId=await repository.beginPost(guildId,messageId,config.channelId,stars);try{const posted=await port.post(guildId,config.channelId,operationId,source,stars);await repository.posted(guildId,messageId,posted,stars);status.set(guildId,'starboard','ready');}catch(error){await repository.unknown(guildId,messageId);throw error;}
  }catch{status.set(guildId,'starboard','degraded','Starboard synchronization is incomplete. Existing posts were preserved unless a deletion was confirmed; unconfirmed sends are never blindly repeated.');}finally{await repository.release(guildId,messageId);}
 }
 const service={sync(guildId:string,channelId:string,messageId:string):Promise<void>{const key=guildId+':'+messageId,pending=(queues.get(key)??Promise.resolve()).catch(()=>undefined).then(()=>sync(guildId,channelId,messageId)).finally(()=>{if(queues.get(key)===pending)queues.delete(key);});queues.set(key,pending);return pending;},async refreshKnown(guildId:string,channelId:string,messageId:string):Promise<void>{if(await repository.read(guildId,messageId))await service.sync(guildId,channelId,messageId);},async reconcile(guildId:string):Promise<void>{for(const row of await repository.oldest(guildId))await service.sync(guildId,row.source_channel_id,row.source_message_id);}};return service;
}
export type StarboardService=ReturnType<typeof createStarboardService>;
