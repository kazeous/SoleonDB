import {randomUUID} from 'node:crypto';
import {automodConfigSchema,automodDefaults} from '@eousbot/contracts';
import type {AppDb} from '../../db/client.js';
import {withTransaction} from '../../db/client.js';
import {withMemberLock} from '../../db/locks.js';
import type {Clock} from '../../core/clock.js';
import type {MessageSnapshot,MessageDisposition,MessageStage} from '../../discord/messages.js';
import type {ProtectionEngine} from '../protection/engine.js';
import type {RuleRepository} from '../protection/repository.js';
import {classifyAutoMod} from './policy.js';
import {createIncidentRepository} from '../moderation/incidents.js';
import type {IncidentIntent} from '../moderation/incidents.js';
export function createGeneralAutoMod(db:AppDb,clock:Clock) {
 const incidents=createIncidentRepository(db);
 return {
  async evaluate(message:MessageSnapshot):Promise<MessageDisposition>{
   if(message.authorKind!=='human')return {kind:'allow'};
   return withTransaction(db,tx=>withMemberLock(tx,message.guildId,message.userId,async()=>{
    const guild=await tx.query('SELECT 1 FROM guilds WHERE id=$1 AND active AND bot_present',[message.guildId]);if(!guild.rowCount)return {kind:'allow'};
    if((await tx.query('SELECT 1 FROM channel_rules WHERE guild_id=$1 AND channel_id=$2 AND enabled AND deleted_at IS NULL LIMIT 1',[message.guildId,message.channelId])).rowCount)return {kind:'held'};
    const stored=(await tx.query<{revision:number;value:unknown}>('SELECT revision,value FROM feature_settings WHERE guild_id=$1 AND feature=$2',[message.guildId,'automod'])).rows[0];
    const config=stored?automodConfigSchema.parse(stored.value):automodDefaults,revision=stored?.revision??0,now=clock.now();
    if(!config.enabled||config.exemptUserIds.includes(message.userId)||config.exemptRoleIds.some(id=>message.member.roleIds.includes(id)))return {kind:'allow'};
    await tx.query('INSERT INTO automod_messages(guild_id,revision,message_id,user_id,channel_id,observed_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[message.guildId,revision,message.id,message.userId,message.channelId,now,now+Math.max(config.spam.windowSeconds,config.violations.windowSeconds)*1000]);
    const count=(await tx.query<{count:number}>('SELECT count(*)::int AS count FROM automod_messages WHERE guild_id=$1 AND revision=$2 AND user_id=$3 AND observed_at>$4',[message.guildId,revision,message.userId,now-config.spam.windowSeconds*1000])).rows[0]!.count;
    const violation=classifyAutoMod(config,message,count);if(!violation)return {kind:'allow'};
    const added=await tx.query('UPDATE automod_messages SET violation_at=$5,expires_at=GREATEST(expires_at,$6) WHERE guild_id=$1 AND revision=$2 AND message_id=$3 AND user_id=$4 AND violation_at IS NULL RETURNING message_id',[message.guildId,revision,message.id,message.userId,now,now+config.violations.windowSeconds*1000]);
    if(!added.rowCount)return {kind:'delete'};
    const violations=(await tx.query<{count:number}>('SELECT count(*)::int AS count FROM automod_messages WHERE guild_id=$1 AND revision=$2 AND user_id=$3 AND violation_at>$4 AND consumed_at IS NULL',[message.guildId,revision,message.userId,now-config.violations.windowSeconds*1000])).rows[0]!.count;
    const cooldown=(await tx.query<{until:string;parent_incident_id:string}>('SELECT until,parent_incident_id FROM member_cooldowns WHERE guild_id=$1 AND user_id=$2',[message.guildId,message.userId])).rows[0];
    const suppressed=!!cooldown&&Number(cooldown.until)>now,threshold=violations>=config.violations.count;
    const intent:IncidentIntent={id:randomUUID(),guildId:message.guildId,userId:message.userId,source:'general_automod',action:threshold&&!suppressed?config.action:null,contributors:[],cleanupMessages:[{channelId:message.channelId,messageId:message.id}],createdAt:now,mode:threshold&&!suppressed?'punish':'cleanup_only',parentIncidentId:suppressed?cooldown!.parent_incident_id:null,reason:'General AutoMod: '+violation,settingsRevision:revision,policySnapshot:{revision,value:config}};
    await incidents.create(tx,intent);
    if(threshold)await tx.query('UPDATE automod_messages SET consumed_at=$3 WHERE guild_id=$1 AND user_id=$2 AND violation_at IS NOT NULL AND consumed_at IS NULL',[message.guildId,message.userId,now]);
    if(intent.action)await tx.query('INSERT INTO member_cooldowns(guild_id,user_id,until,parent_incident_id) VALUES($1,$2,$3,$4) ON CONFLICT(guild_id,user_id) DO UPDATE SET until=$3,parent_incident_id=$4',[message.guildId,message.userId,now+30000,intent.id]);
    return {kind:'delete',incidentId:intent.id};
   }));
  },
  async prune(now:number,limit:number){await db.query('DELETE FROM automod_messages WHERE (guild_id,revision,message_id) IN (SELECT guild_id,revision,message_id FROM automod_messages WHERE expires_at<=$1 ORDER BY expires_at LIMIT $2)',[now,Math.max(1,Math.min(limit,1000))]);},
 };
}
export type GeneralAutoMod=ReturnType<typeof createGeneralAutoMod>;
export function createProtectionStage(channel:ProtectionEngine,general:GeneralAutoMod,rules:RuleRepository):MessageStage {
 return async message=>{if(await rules.hasEnabledInChannel(message.guildId,message.channelId))return channel.observe(message);const result=await general.evaluate(message);return result.kind==='held'?channel.observe(message):result;};
}


