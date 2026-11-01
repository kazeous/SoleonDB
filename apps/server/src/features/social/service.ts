import type {AppDb} from '../../db/client.js';
import type {Clock} from '../../core/clock.js';
import type {FeatureStatusRegistry} from '../../core/status.js';
import {createSettingsService} from '../../guilds/settings.js';
import type {MessageSnapshot,MessageDisposition} from '../../discord/messages.js';
import {rewriteSocialLinks} from './rewrite.js';
import {createSocialRepository} from './repository.js';
import type {SocialRecord} from './repository.js';
export class SocialSendCancelled extends Error{constructor(){super('Social send cancelled before dispatch');}}
export class SocialPostError extends Error{constructor(public readonly outcome:'rejected'|'unknown',message:string){super(message);}}
export interface SocialPayload{content:string;sourceMessageId:string;authorId:string;allowedUserIds:string[]}
export interface SocialPort{post(guildId:string,channelId:string,operationId:string,payload:SocialPayload,authorize:()=>Promise<boolean>):Promise<string>;postWebhook(guildId:string,channelId:string,operationId:string,payload:SocialPayload,authorize:()=>Promise<boolean>):Promise<string|null>;findPost(guildId:string,channelId:string,operationId:string,mode:'bot'|'webhook'):Promise<string|null>;deleteOriginal(guildId:string,channelId:string,messageId:string,authorize?:()=>Promise<boolean>):Promise<void|'deleted'|'missing'|'preserved'>}
export function createSocialService(deps:{db:AppDb;clock:Clock;port:SocialPort;status:FeatureStatusRegistry;canDispatch?:()=>boolean}){
 const {db,clock,port,status}=deps,settings=createSettingsService(db,clock),repository=createSocialRepository(db,clock),queues=new Map<string,Promise<void>>();
 async function recover(record:SocialRecord){const copyId=await port.findPost(record.guildId,record.channelId,record.operationId,record.mode);if(copyId){await repository.sent(record,copyId);status.set(record.guildId,'social','ready');}else status.set(record.guildId,'social','degraded','A replacement send remains unconfirmed. It will not be blindly repeated.');}
 async function process(message:MessageSnapshot,disposition:MessageDisposition):Promise<void>{
  if(disposition.kind==='delete'||message.authorKind!=='human'||message.partial)return;
  const config=await settings.read(message.guildId,'social');if(!config.value.enabled||config.value.watchedChannelIds.length===0){status.set(message.guildId,'social','disabled');return;}if(!config.value.watchedChannelIds.includes(message.channelId))return;
  let record=await repository.read(message.guildId,message.id);if(record&&['sent','failed','cancelled'].includes(record.state))return;
  if(record&&['dispatching','unknown'].includes(record.state)){if(!await repository.claim(record))return;try{await recover(record);}catch{status.set(record.guildId,'social','degraded','Replacement reconciliation failed; existing messages were preserved.');}finally{await repository.release(record);}return;}
  if(message.editedAt!==null&&!record)return;const rewritten=rewriteSocialLinks(message.content,config.value.domains);if(!rewritten.changed)return;
  const safe=message.attachments.length===0&&message.stickerIds.length===0&&message.replyToMessageId===null,useWebhook=config.value.useWebhook&&config.value.deleteOriginal&&safe&&disposition.kind!=='held',payload:SocialPayload={content:(config.value.includeOriginalAuthor&&!useWebhook?'<@'+message.userId+'> ':'')+rewritten.content,authorId:message.userId,sourceMessageId:message.id,allowedUserIds:config.value.includeOriginalAuthor&&!useWebhook?[message.userId]:[]};if(payload.content.length>2000){status.set(message.guildId,'social','degraded','A rewritten message exceeded the Discord content limit. Its original was preserved.');return;}
  const fresh=record?false:await repository.reserve(message.guildId,message.channelId,message.id,message.userId,config.revision,useWebhook?'webhook':'bot');record??=await repository.read(message.guildId,message.id);if(!record||!fresh&&!await repository.claim(record))return;
  try{
   const authorize=(mode:'bot'|'webhook')=>async()=>!(deps.canDispatch&&!deps.canDispatch())&&await repository.authorize(record!,mode);
   if(!await authorize(useWebhook?'webhook':'bot')())throw new SocialSendCancelled();let copyId:string|null=null;
   if(useWebhook)copyId=await port.postWebhook(record.guildId,record.channelId,record.operationId,{...payload,content:rewritten.content,allowedUserIds:[]},authorize('webhook'));
   if(copyId===null){const normal:SocialPayload={content:(config.value.includeOriginalAuthor?'<@'+message.userId+'> ':'')+rewritten.content,authorId:message.userId,sourceMessageId:message.id,allowedUserIds:config.value.includeOriginalAuthor?[message.userId]:[]};if(normal.content.length>2000)throw new SocialPostError('rejected','Attribution exceeds Discord limit');copyId=await port.post(record.guildId,record.channelId,record.operationId,normal,authorize('bot'));}
   await repository.sent(record,copyId);
   if(config.value.deleteOriginal&&safe&&disposition.kind!=='held'&&await repository.canDeleteOriginal(record)){try{const deletion=await port.deleteOriginal(record.guildId,record.channelId,record.sourceMessageId,async()=>!(deps.canDispatch&&!deps.canDispatch())&&await repository.canDeleteOriginal(record!));await repository.originalDeleted(record,deletion==='preserved'?'cancelled':deletion==='missing'?'missing':'succeeded');}catch{await repository.originalDeleted(record,'unknown');status.set(record.guildId,'social','degraded','Replacement is saved, but original-message deletion failed or is unconfirmed.');return;}}
   status.set(record.guildId,'social','ready');
  }catch(error){if(error instanceof SocialSendCancelled){await repository.mark(record,'cancelled');return;}await repository.mark(record,error instanceof SocialPostError&&error.outcome==='rejected'?'failed':'unknown');status.set(record.guildId,'social','degraded','Replacement delivery failed or is unconfirmed. The original was preserved and no blind resend will occur.');}finally{await repository.release(record);}
 }
 return {process(message:MessageSnapshot,disposition:MessageDisposition):Promise<void>{const key=message.guildId+':'+message.id,pending=(queues.get(key)??Promise.resolve()).catch(()=>undefined).then(()=>process(message,disposition)).finally(()=>{if(queues.get(key)===pending)queues.delete(key);});queues.set(key,pending);return pending;},async reconcile(guildId:string):Promise<void>{for(const record of await repository.pending(guildId))if(await repository.claim(record))try{await recover(record);}catch{status.set(guildId,'social','degraded','Replacement reconciliation failed.');}finally{await repository.release(record);}}};
}
export type SocialService=ReturnType<typeof createSocialService>;
