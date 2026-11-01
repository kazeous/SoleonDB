import type {VoicePort} from './ports.js';
import type {VoiceRepository} from './repository.js';
import type {FeatureStatusRegistry} from '../../core/status.js';
import {repairVoicePanel} from './hubs.js';
export function createVoiceRecovery(deps:{repository:VoiceRepository;port:VoicePort;status:FeatureStatusRegistry}){return {
 async reconcile(guildId:string):Promise<void>{for(const record of await deps.repository.list(guildId)){
  if(!await deps.repository.claim(guildId,record.id))continue;
  try{let channelId=record.channelId;if(!channelId){channelId=await deps.port.findCreatedRoom(guildId,record.hubId,record.id);if(!channelId){deps.status.set(guildId,'voice','degraded','A pending room creation remains unconfirmed; no duplicate was created.');continue;}await deps.repository.update(guildId,record.id,{channelId,state:'ready'});}
   const room=await deps.port.getRoom(guildId,channelId);if(!room){await deps.repository.update(guildId,record.id,{state:'deleted'});continue;}if(room.guildId!==guildId||room.channelId!==channelId)throw new Error('Room guild mismatch');
   if(room.memberIds.length===0){if(await deps.port.deleteRoom(guildId,channelId))await deps.repository.update(guildId,record.id,{state:'deleted'});continue;}
   await repairVoicePanel(deps.repository,deps.port,{...record,channelId});if(record.state!=='ready')await deps.repository.update(guildId,record.id,{state:'ready'});
  }catch{deps.status.set(guildId,'voice','degraded','Recorded room recovery failed. Check permissions.');}finally{await deps.repository.update(guildId,record.id,{release:true});}
 }},
};}

