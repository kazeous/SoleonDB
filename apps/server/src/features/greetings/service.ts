import {randomUUID} from 'node:crypto';
import {withTransaction} from '../../db/client.js';
import {withMemberLock} from '../../db/locks.js';
import type {GreetingsConfig,Versioned} from '@eousbot/contracts';
import type {AppDb} from '../../db/client.js';
import type {Clock} from '../../core/clock.js';
import type {FeatureStatusRegistry} from '../../core/status.js';
import {renderGreeting} from './templates.js';
export interface GreetingPort{context(guildId:string,userId:string):Promise<{userName:string;guildName:string}>;sendChannel(guildId:string,channelId:string,text:string,allowedUserIds:string[]):Promise<string>;sendDm(userId:string,text:string):Promise<string>}
export class GreetingDeliveryError extends Error{constructor(public readonly outcome:'rejected'|'unknown',message:string){super(message);}}
export interface GreetingDeliveries{identity?(guildId:string,userId:string,kind:'join'|'leave',provided?:string):Promise<string>;claim(guildId:string,event:string,target:string):Promise<boolean>;finish(guildId:string,event:string,target:string,state:'sent'|'failed'|'unknown',messageId?:string):Promise<void>}
export function createGreetingDeliveryStore(db:AppDb,clock:Clock):GreetingDeliveries&{prune(limit:number):Promise<number>}{return {
 async identity(guildId,userId,kind,provided){return withTransaction(db,tx=>withMemberLock(tx,guildId,userId,async()=>{const previous=(await tx.query<{event_key:string;state:string}>('SELECT event_key,state FROM greeting_memberships WHERE guild_id=$1 AND user_id=$2',[guildId,userId])).rows[0];const key=provided??(kind==='leave'||previous?.state==='join'?previous?.event_key:undefined)??randomUUID();await tx.query('INSERT INTO greeting_memberships(guild_id,user_id,event_key,state,updated_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(guild_id,user_id) DO UPDATE SET event_key=$3,state=$4,updated_at=$5',[guildId,userId,key,kind,clock.now()]);return key;}));},
 async claim(guildId,event,target){return (await db.query("INSERT INTO greeting_deliveries(guild_id,event_key,target,state,created_at) VALUES($1,$2,$3,'dispatching',$4) ON CONFLICT DO NOTHING",[guildId,event,target,clock.now()])).rowCount===1;},
 async finish(guildId,event,target,state,messageId){await db.query('UPDATE greeting_deliveries SET state=$4,message_id=$5 WHERE guild_id=$1 AND event_key=$2 AND target=$3',[guildId,event,target,state,messageId??null]);},
 async prune(limit){return (await db.query('DELETE FROM greeting_deliveries WHERE (guild_id,event_key,target) IN (SELECT guild_id,event_key,target FROM greeting_deliveries WHERE created_at<$1 ORDER BY created_at LIMIT $2)',[clock.now()-604800000,limit])).rowCount??0;},
};}
export function createGreetingService(deps:{settings:{read(guildId:string,key:'greetings'):Promise<Versioned<GreetingsConfig>>};deliveries:GreetingDeliveries;port:GreetingPort;status:FeatureStatusRegistry}){
 async function changed(kind:'join'|'leave',guildId:string,userId:string,provided?:string){
  const config=(await deps.settings.read(guildId,'greetings')).value;if(!config.enabled){deps.status.set(guildId,'greetings','disabled');return;}
  const eventKey=await deps.deliveries.identity?.(guildId,userId,kind,provided)??provided??'current';
  const identity=await deps.port.context(guildId,userId),context={userMention:'<@'+userId+'>',userName:identity.userName,guildName:identity.guildName},event=kind+':'+userId+':'+eventKey;let failed=false;
  async function deliver(target:'channel'|'dm',send:()=>Promise<string>){if(!await deps.deliveries.claim(guildId,event,target))return;try{const id=await send();await deps.deliveries.finish(guildId,event,target,'sent',id);}catch(error){failed=true;await deps.deliveries.finish(guildId,event,target,error instanceof GreetingDeliveryError&&error.outcome==='rejected'?'failed':'unknown');}}
  const channelId=kind==='join'?config.joinChannelId:config.leaveChannelId,template=kind==='join'?config.joinTemplate:config.leaveTemplate;
  if(channelId&&template)await deliver('channel',()=>deps.port.sendChannel(guildId,channelId,renderGreeting(template,context),kind==='join'?[userId]:[]));
  if(kind==='join'&&config.dmEnabled&&config.dmTemplate)await deliver('dm',()=>deps.port.sendDm(userId,renderGreeting(config.dmTemplate,context)));
  deps.status.set(guildId,'greetings',failed?'degraded':'ready',...(failed?['A greeting delivery failed. Check channel permissions or the member DM settings.']:[]));
 }
 return {memberJoined:(guildId:string,userId:string,eventKey?:string)=>changed('join',guildId,userId,eventKey),memberLeft:(guildId:string,userId:string,eventKey?:string)=>changed('leave',guildId,userId,eventKey)};
}
export type GreetingService=ReturnType<typeof createGreetingService>;
