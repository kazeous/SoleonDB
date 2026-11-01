import {voiceActionSchema} from '@eousbot/contracts';
import type {VoiceAction} from '@eousbot/contracts';
import {AppError} from '../../core/errors.js';
import type {FeatureStatusRegistry} from '../../core/status.js';
import type {VoicePort,VoiceProperties,VoiceOverwrite} from './ports.js';
import type {VoiceRepository} from './repository.js';
export interface VoiceContext{guildId:string;channelId:string;actorId:string;messageId?:string}
export function createVoiceControlService(deps:{repository:VoiceRepository;port:VoicePort;status:FeatureStatusRegistry}){
 const queues=new Map<string,Promise<void>>();
 async function execute(context:VoiceContext,raw:VoiceAction):Promise<void>{
  const {guildId,channelId,actorId}=context,action=voiceActionSchema.parse(raw),record=await deps.repository.byChannel(guildId,channelId);if(!record||record.state!=='ready'||context.messageId!==undefined&&record.panelId!==context.messageId)throw new AppError('not_found','This is not a registered current voice-room panel');
  const [room,actor]=await Promise.all([deps.port.getRoom(guildId,channelId),deps.port.member(guildId,actorId)]);if(!room||room.guildId!==guildId||room.channelId!==channelId)throw new AppError('not_found','Recorded voice room is missing');if(!actor||actor.guildId!==guildId||actor.isBot||actor.id!==record.ownerId&&(BigInt(actor.permissions)&(16n|8n))===0n)throw new AppError('forbidden','Only the current owner or a member with Manage Channels can control this room');
  if('userId' in action){const user=await deps.port.member(guildId,action.userId);if(!user||user.guildId!==guildId||user.isBot)throw new AppError('validation','Select a human member of this server');if(action.kind==='transfer'&&user.voiceChannelId!==channelId)throw new AppError('validation','The new owner must be in this voice room');if(action.kind==='deny-user'&&action.userId===record.ownerId)throw new AppError('validation','Transfer ownership before denying the owner access');}
  if('roleId' in action){const role=await deps.port.role(guildId,action.roleId);if(!role||role.guildId!==guildId||role.id===guildId||role.managed)throw new AppError('validation','Select an ordinary role in this server');}
  let properties:VoiceProperties|undefined,overwrite:VoiceOverwrite|undefined,ownerId=record.ownerId;
  switch(action.kind){
   case 'rename':properties={name:action.name};break;
   case 'limit':properties={limit:action.limit};break;
   case 'status':properties={status:action.status};break;
   case 'lfg':properties={status:'Looking for teammates'};break;
   case 'game':{const owner=actor.id===ownerId?actor:await deps.port.member(guildId,ownerId);if(!owner?.game)throw new AppError('unavailable','No current game is visible. Enable Guild Presences and make the owner activity visible.');properties={name:owner.game.slice(0,100)};break;}
   case 'bitrate':if(action.bitrate>room.maxBitrate)throw new AppError('validation','Maximum bitrate for this server is '+room.maxBitrate+' bits per second');properties={bitrate:action.bitrate};break;
   case 'region':if(action.region!==null&&!room.regions.includes(action.region))throw new AppError('validation','Choose automatic or an advertised RTC region: '+room.regions.join(', '));properties={region:action.region};break;
   case 'nsfw':properties={nsfw:action.enabled};break;
   case 'text':overwrite=action;break;
   case 'allow-user':case 'deny-user':overwrite={kind:action.kind,id:action.userId};break;
   case 'allow-role':case 'deny-role':overwrite={kind:action.kind,id:action.roleId};break;
   case 'transfer':if(action.expectedOwnerId!==ownerId||!await deps.repository.transfer(guildId,channelId,action.expectedOwnerId,action.userId))throw new AppError('conflict','Ownership changed. Refresh the panel before transferring.');overwrite={kind:'transfer',oldOwnerId:ownerId,newOwnerId:action.userId};ownerId=action.userId;break;
   case 'invite':{const result=await deps.port.invite(guildId,channelId,action.userId);if(!result.delivered)throw new AppError('unavailable','One-use invite created, but the DM was blocked. Share this invite directly: '+result.url);deps.status.set(guildId,'voice','ready');return;}
   default:overwrite=action;
  }
  try{if(properties)await deps.port.setProperties(guildId,channelId,properties);if(overwrite)await deps.port.setOverwrites(guildId,channelId,ownerId,overwrite);deps.status.set(guildId,'voice','ready');}catch{deps.status.set(guildId,'voice','degraded','A voice control was blocked or unconfirmed. Inspect the current room before retrying.');throw new AppError('unavailable','Discord could not confirm this room change. Check permissions and the current room state before retrying.');}
 }
 return {execute(context:VoiceContext,action:VoiceAction):Promise<void>{const key=context.guildId+':'+context.channelId,pending=(queues.get(key)??Promise.resolve()).catch(()=>undefined).then(()=>execute(context,action)).finally(()=>{if(queues.get(key)===pending)queues.delete(key);});queues.set(key,pending);return pending;}};
}
export type VoiceControlService=ReturnType<typeof createVoiceControlService>;
