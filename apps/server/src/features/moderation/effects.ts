import {withMemberLock} from '../../db/locks.js';
import type {AppDb,SqlSession} from '../../db/client.js';
import {withTransaction} from '../../db/client.js';
import type {CaseOutcome,IncidentIntent} from './incidents.js';
export interface EffectRow {guild_id:string;incident_id:string;effect_key:string;kind:'cleanup'|'punishment';channel_id:string|null;message_id:string|null;state:string;reason:string|null;request:{until?:number;skip?:boolean;blockedReason?:string}|null}
export async function readEffects(session:SqlSession,intent:IncidentIntent):Promise<EffectRow[]> {return (await session.query<EffectRow>('SELECT * FROM incident_effects WHERE guild_id=$1 AND incident_id=$2 ORDER BY effect_key',[intent.guildId,intent.id])).rows;}
export function summarizeEffects(rows:EffectRow[]):CaseOutcome {
 const cleanups=rows.filter(r=>r.kind==='cleanup'),punishment=rows.find(r=>r.kind==='punishment');
 const cleanup={deleted:cleanups.filter(r=>r.state==='succeeded').length,missing:cleanups.filter(r=>r.state==='missing').length,failed:cleanups.filter(r=>r.state==='failed').length};
 const cancelled=rows.find(r=>r.state==='cancelled');
 const unknown=rows.some(r=>['unknown','dispatching','pending'].includes(r.state));
 const rawPunishmentState=punishment?.state??'not_requested';
 const punishmentState=rawPunishmentState==='dispatching'?'unknown':rawPunishmentState;
 const success=cleanup.deleted+cleanup.missing+(punishmentState==='succeeded'?1:0);
 const unsuccessful=rows.some(r=>['failed','blocked'].includes(r.state));
 const state=unknown?'unknown':cancelled?'cancelled':!unsuccessful?'succeeded':success>0?'partial':punishmentState==='blocked'?'blocked':'failed';
 return {state,cleanup,punishment:{state:punishmentState as CaseOutcome['punishment']['state'],...(punishment?.reason?{reason:punishment.reason}:{})},...(cancelled?{cancellation:{reason:cancelled.reason??'Configuration changed before dispatch'}}:{})};
}
export async function completeEffect(db:AppDb,intent:IncidentIntent,key:string,state:string,now:number,reason?:string):Promise<void>{await db.query('UPDATE incident_effects SET state=$4,completed_at=$5,reason=$6 WHERE guild_id=$1 AND incident_id=$2 AND effect_key=$3 AND state<>$7',[intent.guildId,intent.id,key,state,now,reason??null,'cancelled']);}
export async function finishIncident(db:AppDb,intent:IncidentIntent):Promise<CaseOutcome>{
 // Share the member lock with late-copy registration so finalization cannot strand new cleanup.
 return withTransaction(db,tx=>withMemberLock(tx,intent.guildId,intent.userId,async()=>{
  const effects=await readEffects(tx,intent),outcome=summarizeEffects(effects),state=effects.some(effect=>effect.state==='pending')?'pending':'complete';
  await tx.query("UPDATE moderation_incidents SET state=$3,lease_until=NULL,dispatch_token=NULL WHERE guild_id=$1 AND id=$2",[intent.guildId,intent.id,state]);
  await tx.query('UPDATE moderation_cases SET outcome=$3 WHERE guild_id=$1 AND id=$2',[intent.guildId,intent.id,outcome]);return outcome;
 }));
}

