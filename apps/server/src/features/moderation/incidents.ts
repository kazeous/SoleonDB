import type {RuleAction,ChannelRule,AutoModSnapshot} from '@eousbot/contracts';
import type {AppDb,AppTx} from '../../db/client.js';
export interface IncidentIntent {
 id:string;guildId:string;userId:string;source:'channel_rule'|'general_automod'|'command';action:RuleAction|null;
 contributors:Array<{ruleId:string;revision:number;messageIds:string[]}>;
 cleanupMessages:Array<{channelId:string;messageId:string}>;createdAt:number;
 mode:'punish'|'cleanup_only';parentIncidentId:string|null;
 policySnapshot?:AutoModSnapshot;settingsRevision?:number;operationKey?:string;command?:'warn'|'timeout'|'kick'|'ban'|'clean';
 actorId?:string;reason?:string;ruleSnapshots?:ChannelRule[];requestedTimeoutUntil?:number;
}
export interface CaseOutcome {
 state:'succeeded'|'partial'|'blocked'|'failed'|'unknown'|'cancelled';
 cancellation?:{reason:string};
 cleanup:{deleted:number;missing:number;failed:number};
 punishment:{state:'pending'|'succeeded'|'blocked'|'failed'|'unknown'|'cancelled'|'not_requested';reason?:string};
}
export function createIncidentRepository(db:AppDb) {
 return {
  async create(tx:AppTx,intent:IncidentIntent):Promise<void>{
   await tx.query('INSERT INTO moderation_incidents(guild_id,id,user_id,source,intent,created_at,operation_key) VALUES($1,$2,$3,$4,$5,$6,$7)',[intent.guildId,intent.id,intent.userId,intent.source,intent,intent.createdAt,intent.operationKey??null]);
   const number=(await tx.query<{number:number}>('INSERT INTO guild_case_counters(guild_id,next_number) VALUES($1,2) ON CONFLICT(guild_id) DO UPDATE SET next_number=guild_case_counters.next_number+1 RETURNING next_number-1 AS number',[intent.guildId])).rows[0]!.number;
   await tx.query('INSERT INTO moderation_cases(guild_id,id,number,target_id,actor_id,source,action,reason,rule_snapshot,created_at,duration_seconds,policy_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[intent.guildId,intent.id,number,intent.userId,intent.actorId??null,intent.source,intent.command??intent.action?.kind??null,intent.reason??'Channel protection threshold reached',JSON.stringify(intent.ruleSnapshots??[]),intent.createdAt,intent.action?.kind==='timeout'?intent.action.durationSeconds:null,intent.policySnapshot??null]);
  },
  async claimNext(workerId:string,now:number):Promise<IncidentIntent|null>{
   const result=await db.query<{intent:IncidentIntent}>("WITH candidate AS (SELECT guild_id,id FROM moderation_incidents WHERE state='pending' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE moderation_incidents AS i SET state='claimed',worker_id=$1,lease_until=$2 FROM candidate AS c WHERE i.guild_id=c.guild_id AND i.id=c.id RETURNING i.intent",[workerId,now+30000]);return result.rows[0]?.intent??null;
  },
  async get(id:string):Promise<IncidentIntent|null>{return (await db.query<{intent:IncidentIntent}>('SELECT intent FROM moderation_incidents WHERE id=$1',[id])).rows[0]?.intent??null;},
 };
}
export type IncidentRepository=ReturnType<typeof createIncidentRepository>;

