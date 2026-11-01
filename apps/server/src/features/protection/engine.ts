import {randomUUID} from 'node:crypto';
import type {AppDb} from '../../db/client.js';
import {withTransaction} from '../../db/client.js';
import {withMemberLock} from '../../db/locks.js';
import type {Clock} from '../../core/clock.js';
import type {MessageSnapshot,MessageDisposition} from '../../discord/messages.js';
import {createRuleRepository} from './repository.js';
import {createObservationRepository} from './observations.js';
import {createIncidentRepository} from '../moderation/incidents.js';
import type {IncidentIntent} from '../moderation/incidents.js';
import {matchesRule} from './matcher.js';
import {chooseAction} from './arbiter.js';
export function createProtectionEngine(db:AppDb,clock:Clock) {
 const rules=createRuleRepository(db),observations=createObservationRepository(db),incidents=createIncidentRepository(db);
 return {
  async observe(message:MessageSnapshot):Promise<MessageDisposition>{
   if(message.authorKind!=='human'||message.isThread)return {kind:'allow'};
   return withTransaction(db,tx=>withMemberLock(tx,message.guildId,message.userId,async()=>{
    const guild=await tx.query('SELECT 1 FROM guilds WHERE id=$1 AND active AND bot_present',[message.guildId]);if(!guild.rowCount)return {kind:'allow'};
    const current=await rules.forChannel(tx,message.guildId,message.channelId),now=clock.now();
    const contributors:IncidentIntent['contributors']=[],snapshots=[],cleanup=new Map<string,{channelId:string;messageId:string}>();
    for(const rule of current) {
     if(!matchesRule(rule,message))continue;
     if(message.editedAt!==null&&now-message.createdAt>rule.threshold.windowSeconds*1000)continue;
     if(!await observations.record(tx,rule,message,now))continue;
     const matches=await observations.active(tx,rule,message.userId,now);
     if(matches.length<rule.threshold.count)continue;
     contributors.push({ruleId:rule.id,revision:rule.revision,messageIds:matches.map(m=>m.messageId)});snapshots.push(rule);
     for(const match of matches)cleanup.set(match.channelId+':'+match.messageId,match);
    }
    if(!contributors.length)return {kind:current.length?'held':'allow'};
    const cooldown=(await tx.query<{until:string;parent_incident_id:string}>('SELECT until,parent_incident_id FROM member_cooldowns WHERE guild_id=$1 AND user_id=$2',[message.guildId,message.userId])).rows[0];
    const suppressed=!!cooldown&&Number(cooldown.until)>now;
    const intent:IncidentIntent={id:randomUUID(),guildId:message.guildId,userId:message.userId,source:'channel_rule',contributors,cleanupMessages:[...cleanup.values()],createdAt:now,mode:suppressed?'cleanup_only':'punish',parentIncidentId:suppressed?cooldown!.parent_incident_id:null,action:suppressed?null:chooseAction(snapshots.map(rule=>rule.action)),ruleSnapshots:snapshots};
    await incidents.create(tx,intent);
    await observations.consume(tx,message.guildId,message.userId,now,suppressed?contributors:undefined);
    if(!suppressed)await tx.query('INSERT INTO member_cooldowns(guild_id,user_id,until,parent_incident_id) VALUES($1,$2,$3,$4) ON CONFLICT(guild_id,user_id) DO UPDATE SET until=$3,parent_incident_id=$4',[message.guildId,message.userId,now+30000,intent.id]);
    return {kind:'delete',incidentId:intent.id};
   }));
  },
 };
}
export type ProtectionEngine=ReturnType<typeof createProtectionEngine>;

