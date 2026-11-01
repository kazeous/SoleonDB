import {automodConfigSchema} from '@eousbot/contracts';
import {randomUUID} from 'node:crypto';
import type {AppDb} from '../../db/client.js';
import {withTransaction} from '../../db/client.js';
import {withMemberLock} from '../../db/locks.js';
import type {Clock} from '../../core/clock.js';
import {AppError} from '../../core/errors.js';
import {createRuleRepository} from '../protection/repository.js';
import {createIncidentRepository} from './incidents.js';
import type {IncidentIntent,CaseOutcome} from './incidents.js';
import type {ModerationPort,RelatedMessageStore,TargetEligibility} from './ports.js';
import {ModerationEffectError,ModerationSendCancelled} from './ports.js';
import {readEffects,completeEffect,finishIncident} from './effects.js';
import type {EffectRow} from './effects.js';
export interface EnforcementDeps {db:AppDb;clock:Clock;port:ModerationPort;related:RelatedMessageStore;canDispatch?:()=>boolean;authorizeCommand?:(intent:IncidentIntent)=>Promise<void>;log?:(intent:IncidentIntent,outcome:CaseOutcome)=>Promise<void>}
async function deadline<T>(run:()=>Promise<T>):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([run(),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new ModerationEffectError('unknown','Discord request outcome unknown')),15000);})]);}finally{if(timer)clearTimeout(timer);}
}
export function createEnforcementService(deps:EnforcementDeps) {
 const {db,clock,port}=deps,rules=createRuleRepository(db),incidents=createIncidentRepository(db),active=new Map<string,Promise<CaseOutcome>>();
 async function ensureEffects(intent:IncidentIntent){
  const messages=new Map(intent.cleanupMessages.map(m=>[m.channelId+':'+m.messageId,m]));
  for(const original of intent.cleanupMessages)for(const copy of await deps.related.list(intent.guildId,original.messageId))messages.set(copy.channelId+':'+copy.messageId,copy);
  await withTransaction(db,async tx=>{
   await tx.query('INSERT INTO incident_effects(guild_id,incident_id,effect_key,kind,state) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[intent.guildId,intent.id,'punishment','punishment',intent.action?'pending':'not_requested']);
   for(const m of messages.values())await tx.query('INSERT INTO incident_effects(guild_id,incident_id,effect_key,kind,channel_id,message_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[intent.guildId,intent.id,'cleanup:'+m.channelId+':'+m.messageId,'cleanup',m.channelId,m.messageId]);
  });
 }
 async function authorize(intent:IncidentIntent,token:string,keys:string[],target:TargetEligibility,request:EffectRow['request']=null):Promise<EffectRow[]>{
  if(deps.canDispatch&&!deps.canDispatch())throw new AppError('unavailable','Worker is not active');
  return withTransaction(db,tx=>withMemberLock(tx,intent.guildId,intent.userId,async()=>{
   const owned=await tx.query('SELECT 1 FROM moderation_incidents WHERE guild_id=$1 AND id=$2 AND dispatch_token=$3 AND state=$4',[intent.guildId,intent.id,token,'running']);
   if(!owned.rowCount)throw new AppError('conflict','Incident is owned by another dispatcher');
   let invalid=(await tx.query('SELECT 1 FROM guilds WHERE id=$1 AND active AND bot_present',[intent.guildId])).rowCount===0;
   for(const contributor of intent.contributors){const current=await rules.current(tx,intent.guildId,contributor.ruleId);if(!current||!current.enabled||current.revision!==contributor.revision||current.exemptUserIds.includes(intent.userId)||current.exemptRoleIds.some(id=>target.roleIds.includes(id)))invalid=true;}
   if(intent.source==='general_automod'){
    const stored=(await tx.query<{revision:number;value:unknown}>('SELECT revision,value FROM feature_settings WHERE guild_id=$1 AND feature=$2',[intent.guildId,'automod'])).rows[0];
    const config=stored?automodConfigSchema.parse(stored.value):null;
    for(const channelId of new Set(intent.cleanupMessages.map(message=>message.channelId)))if((await tx.query('SELECT 1 FROM channel_rules WHERE guild_id=$1 AND channel_id=$2 AND enabled AND deleted_at IS NULL LIMIT 1',[intent.guildId,channelId])).rowCount)invalid=true;
    if(!config?.enabled||stored?.revision!==intent.settingsRevision||config.exemptUserIds.includes(intent.userId)||config.exemptRoleIds.some(id=>target.roleIds.includes(id)))invalid=true;
   }
   if(invalid){await tx.query("UPDATE incident_effects SET state='cancelled',reason=$3,completed_at=$4 WHERE guild_id=$1 AND incident_id=$2 AND state='pending'",[intent.guildId,intent.id,'Configuration changed or target became exempt before dispatch',clock.now()]);return [];}
   // This durable authorization point precedes dispatch with no intervening external await.
   await tx.query('UPDATE moderation_incidents SET lease_until=$3 WHERE guild_id=$1 AND id=$2',[intent.guildId,intent.id,clock.now()+60000]);
   return (await tx.query<EffectRow>("UPDATE incident_effects SET state='dispatching',authorized_at=$4,request=$5 WHERE guild_id=$1 AND incident_id=$2 AND effect_key=ANY($3::text[]) AND state='pending' RETURNING *",[intent.guildId,intent.id,keys,clock.now(),request])).rows;
  }));
 }
 function blockedTarget(intent:IncidentIntent,target:TargetEligibility):string|undefined{if(target.isOwner)return 'The server owner cannot be punished';if(intent.action?.kind==='timeout'&&target.isAdministrator)return 'Discord does not allow timeouts for administrators';if(intent.action?.kind==='timeout'&&!target.botCanTimeout)return 'Bot lacks timeout permission or role hierarchy';if(intent.action?.kind==='kick'&&!target.botCanKick)return 'Bot lacks kick permission or role hierarchy';if(intent.action?.kind==='ban'&&!target.botCanBan)return 'Bot lacks ban permission or role hierarchy';return undefined;}
 async function punish(intent:IncidentIntent,token:string){
  const effect=(await readEffects(db,intent)).find(row=>row.effect_key==='punishment');if(!intent.action||effect?.state!=='pending')return;
  const until=intent.action.kind==='timeout'?clock.now()+intent.action.durationSeconds*1000:undefined;
  async function authorizePrepared():Promise<boolean>{
   if(deps.canDispatch&&!deps.canDispatch())return false;
   if(intent.source==='command'&&deps.authorizeCommand)try{await deps.authorizeCommand(intent);}catch{await completeEffect(db,intent,'punishment','blocked',clock.now(),'Actor permission or hierarchy no longer allows this action');return false;}
   let target:TargetEligibility;try{target=await deadline(()=>port.inspect(intent.guildId,intent.userId));}catch{await completeEffect(db,intent,'punishment','failed',clock.now(),'Target permissions unavailable; no action sent');return false;}
   const blockedReason=blockedTarget(intent,target),skip=until!==undefined&&target.timeoutUntil!==null&&target.timeoutUntil>=until,request={...(until===undefined?{}:{until}),...(skip?{skip:true}:{}),...(blockedReason?{blockedReason}:{})};
   if(!(await authorize(intent,token,['punishment'],target,request)).length)return false;
   if(blockedReason){await completeEffect(db,intent,'punishment','blocked',clock.now(),blockedReason);return false;}
   if(skip){await completeEffect(db,intent,'punishment','succeeded',clock.now(),'Existing timeout is at least as long; it was not shortened');return false;}return true;
  }
  const reason='[incident:'+intent.id+'] '+(intent.reason??'Channel protection threshold reached').slice(0,400);let state='succeeded',failureReason:string|undefined;
  try{if(intent.action.kind==='timeout')await deadline(()=>port.timeout(intent.guildId,intent.userId,until!,reason,authorizePrepared));else if(intent.action.kind==='kick')await deadline(()=>port.kick(intent.guildId,intent.userId,reason,authorizePrepared));else await deadline(()=>port.ban(intent.guildId,intent.userId,reason,authorizePrepared));}
  catch(error){if(error instanceof ModerationSendCancelled)return;state=error instanceof ModerationEffectError&&error.outcome==='rejected'?'failed':'unknown';failureReason=state==='unknown'?'Discord outcome is unknown; this punishment will not be blindly repeated':'Discord rejected this action';}
  await completeEffect(db,intent,'punishment',state,clock.now(),failureReason);
 }
 async function cleanup(intent:IncidentIntent,token:string){
  while(true){
   if(deps.canDispatch&&!deps.canDispatch())return;
   const pending=(await readEffects(db,intent)).filter(row=>row.kind==='cleanup'&&row.state==='pending').slice(0,5);if(!pending.length)return;
   const results=await Promise.allSettled(pending.map(async effect=>{
    async function authorizePrepared():Promise<boolean>{if(deps.canDispatch&&!deps.canDispatch())return false;if(intent.source==='command'&&deps.authorizeCommand)try{await deps.authorizeCommand(intent);}catch{await completeEffect(db,intent,effect.effect_key,'failed',clock.now(),'Actor no longer has cleanup permission');return false;}let target:TargetEligibility;try{target=await deadline(()=>port.inspect(intent.guildId,intent.userId));}catch{await completeEffect(db,intent,effect.effect_key,'failed',clock.now(),'Target state unavailable; no deletion sent');return false;}return (await authorize(intent,token,[effect.effect_key],target)).length>0;}
    let state:string,reason:string|undefined;
    try{state=(await deadline(()=>port.deleteMessage(intent.guildId,effect.channel_id!,effect.message_id!,authorizePrepared)))==='missing'?'missing':'succeeded';}
    catch(error){if(error instanceof ModerationSendCancelled)return;state=error instanceof ModerationEffectError&&error.outcome==='rejected'?'failed':'unknown';reason=state==='failed'?'Discord rejected message deletion':'Message deletion outcome unknown';}
    await completeEffect(db,intent,effect.effect_key,state,clock.now(),reason);
   }));const failed=results.find(result=>result.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
  }
 }
 async function run(id:string):Promise<CaseOutcome>{
  const intent=await incidents.get(id);if(!intent)throw new AppError('not_found','Incident not found');
  const token=randomUUID();
  const claim=await db.query("UPDATE moderation_incidents SET state='running',dispatch_token=$2,lease_until=$3 WHERE id=$1 AND (state IN ('pending','claimed') OR (state='running' AND lease_until<=$4)) RETURNING id",[id,token,clock.now()+60000,clock.now()]);
  if(!claim.rowCount){const existing=await db.query<{outcome:CaseOutcome|null}>("SELECT c.outcome FROM moderation_cases c JOIN moderation_incidents i ON i.guild_id=c.guild_id AND i.id=c.id WHERE i.id=$1 AND i.state='complete'",[id]);if(existing.rows[0]?.outcome)return existing.rows[0].outcome;throw new AppError('conflict','Incident is already being dispatched');}
  await ensureEffects(intent);
  const results=await Promise.allSettled([punish(intent,token),cleanup(intent,token)]);
  const failed=results.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
  const outcome=await finishIncident(db,intent);await deps.log?.(intent,outcome);return outcome;
 }
 return {dispatch(id:string):Promise<CaseOutcome>{const existing=active.get(id);if(existing)return existing;const promise=run(id).finally(()=>active.delete(id));active.set(id,promise);return promise;}};
}
export type EnforcementService=ReturnType<typeof createEnforcementService>;



