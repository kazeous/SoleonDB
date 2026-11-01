import type {AppDb} from '../../db/client.js';
import type {Logger} from '../../core/logger.js';
import type {FeatureStatusRegistry} from '../../core/status.js';
import {moderationConfigSchema} from '@eousbot/contracts';
import type {IncidentIntent,CaseOutcome} from './incidents.js';
export function createCaseLogger(deps:{db:AppDb;logger:Logger;registry:FeatureStatusRegistry;port:{send(guildId:string,channelId:string,text:string):Promise<void>}}) {
 return async(intent:IncidentIntent,outcome:CaseOutcome):Promise<void>=>{
  deps.logger.info({guildId:intent.guildId,incidentId:intent.id,outcome:outcome.state},'Moderation incident completed');
  try {
   const stored=(await deps.db.query<{value:unknown}>('SELECT value FROM feature_settings WHERE guild_id=$1 AND feature=$2',[intent.guildId,'moderation'])).rows[0];
   if(!stored)return;const settings=moderationConfigSchema.parse(stored.value);if(!settings.enabled||!settings.logChannelId)return;
   const number=(await deps.db.query<{number:number}>('SELECT number FROM moderation_cases WHERE guild_id=$1 AND id=$2',[intent.guildId,intent.id])).rows[0]?.number;
   const text='Case #'+number+' · '+outcome.state+'\nTarget: '+intent.userId+' · Source: '+intent.source+'\nPunishment: '+outcome.punishment.state+(outcome.punishment.reason?' ('+outcome.punishment.reason+')':'')+'\nCleanup: '+outcome.cleanup.deleted+' deleted, '+outcome.cleanup.missing+' already missing, '+outcome.cleanup.failed+' failed'+(outcome.cancellation?'\nRemaining work cancelled: '+outcome.cancellation.reason:'');
   await deps.port.send(intent.guildId,settings.logChannelId,text);
  }catch {deps.registry.set(intent.guildId,'moderation','degraded','Case was stored, but its moderation log could not be delivered. Check channel permissions.');deps.logger.warn({guildId:intent.guildId,incidentId:intent.id},'Moderation log delivery failed');}
 };
}

