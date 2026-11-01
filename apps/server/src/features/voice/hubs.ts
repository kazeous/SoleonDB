import type {VoiceConfig,Versioned} from '@eousbot/contracts';
import type {FeatureStatusRegistry} from '../../core/status.js';
import type {VoicePort} from './ports.js';
import type {VoiceRepository,VoiceRecord} from './repository.js';
export async function repairVoicePanel(repository:VoiceRepository,port:VoicePort,room:VoiceRecord):Promise<void>{
 if(!room.channelId)return;
 if(room.panelId&&await port.panelExists(room.guildId,room.channelId,room.panelId))return;
 // Reserve a new identity only for an initial panel or a confirmed deleted panel.
 // A bounded negative lookup cannot prove that a previous send was rejected.
 if(room.panelState==='sending'||room.panelState==='unknown'){
  const panelId=room.panelOperationId?await port.findPanel(room.guildId,room.channelId,room.panelOperationId):null;
  if(panelId&&room.panelOperationId){await repository.update(room.guildId,room.id,{panelId,panelState:'sent',expectedPanelOperationId:room.panelOperationId});return;}
  await repository.update(room.guildId,room.id,{panelState:'unknown'});throw new Error('Voice panel delivery remains unconfirmed; no duplicate was sent');
 }
 const delivery=await repository.beginPanel(room.guildId,room.id,room.panelId);
 if(!delivery?.panelOperationId)throw new Error('Voice panel reservation changed');
 try{const panelId=await port.postOrEditPanel(room.guildId,room.channelId,room.ownerId,null,delivery.panelOperationId);await repository.update(room.guildId,room.id,{panelId,panelState:'sent',expectedPanelOperationId:delivery.panelOperationId});}
 catch(error){await repository.update(room.guildId,room.id,{panelState:'unknown',expectedPanelOperationId:delivery.panelOperationId});throw error;}
}
export function createVoiceHubService(deps:{settings:{read(guildId:string,key:'voice'):Promise<Versioned<VoiceConfig>>};repository:VoiceRepository;port:VoicePort;status:FeatureStatusRegistry}){
 const queues=new Map<string,Promise<void>>();
 async function changed(event:{guildId:string;userId:string;oldChannelId:string|null;newChannelId:string|null}){
  const {guildId,userId,newChannelId,oldChannelId}=event,config=(await deps.settings.read(guildId,'voice')).value;if(!config.enabled){deps.status.set(guildId,'voice','disabled');return;}
  if(oldChannelId&&oldChannelId!==newChannelId){const recorded=await deps.repository.byChannel(guildId,oldChannelId);if(recorded&&await deps.repository.claim(guildId,recorded.id))try{const room=await deps.port.getRoom(guildId,oldChannelId);if(!room||room.memberIds.length===0&&await deps.port.deleteRoom(guildId,oldChannelId))await deps.repository.update(guildId,recorded.id,{state:'deleted'});}finally{await deps.repository.update(guildId,recorded.id,{release:true});}}
  if(!newChannelId||oldChannelId===newChannelId||!config.hubChannelIds.includes(newChannelId))return;
  const member=await deps.port.member(guildId,userId);if(!member||member.guildId!==guildId||member.isBot||member.voiceChannelId!==newChannelId)return;
  const hub=await deps.port.hub(guildId,newChannelId),reservation=await deps.repository.reserve(guildId,newChannelId,userId,hub),record=reservation.room;let channelId=record.channelId;
  if(!reservation.fresh&&!await deps.repository.claim(guildId,record.id))return;
  try{
   channelId??=reservation.fresh?await deps.port.createRoom(guildId,newChannelId,userId,config.roomFormat.replaceAll('{user}',member.displayName).slice(0,100),record.id):await deps.port.findCreatedRoom(guildId,newChannelId,record.id);
   if(!channelId){deps.status.set(guildId,'voice','degraded','Room creation is unconfirmed. Audit-log access may be needed for recovery.');return;}
   await deps.repository.update(guildId,record.id,{channelId,state:'ready'});
   try{await deps.port.move(guildId,userId,channelId);}catch{const current=await deps.port.getRoom(guildId,channelId);if(!current||current.memberIds.length===0&&await deps.port.deleteRoom(guildId,channelId))await deps.repository.update(guildId,record.id,{state:'deleted'});else await deps.repository.update(guildId,record.id,{state:'move_failed'});deps.status.set(guildId,'voice','degraded','The member could not be moved; the new room was removed only if empty.');return;}
   await repairVoicePanel(deps.repository,deps.port,{...record,channelId});deps.status.set(guildId,'voice','ready');
  }catch{await deps.repository.update(guildId,record.id,{state:channelId?'ready':'unknown'});deps.status.set(guildId,'voice','degraded','Room creation or panel delivery needs recovery.');}
  finally{await deps.repository.update(guildId,record.id,{release:true});}
 }
 return {changed(event:Parameters<typeof changed>[0]):Promise<void>{const key=event.guildId+':'+event.userId,pending=(queues.get(key)??Promise.resolve()).catch(()=>undefined).then(()=>changed(event)).finally(()=>{if(queues.get(key)===pending)queues.delete(key);});queues.set(key,pending);return pending;}};
}
export type VoiceHubService=ReturnType<typeof createVoiceHubService>;
