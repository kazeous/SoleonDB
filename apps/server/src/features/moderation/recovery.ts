import type {AppDb} from '../../db/client.js';
import type {Clock} from '../../core/clock.js';
import type {ModerationPort} from './ports.js';
import type {IncidentIntent} from './incidents.js';
import {readEffects,completeEffect,finishIncident} from './effects.js';
export function createRecoveryService(deps:{db:AppDb;clock:Clock;port:ModerationPort}) {
 return {
  async recoverPending():Promise<void>{
   const incidents=(await deps.db.query<{intent:IncidentIntent}>("SELECT intent FROM moderation_incidents WHERE state IN ('claimed','running') AND lease_until<=$1 ORDER BY created_at,id LIMIT 25",[deps.clock.now()])).rows;
   for(const {intent} of incidents){
    const effects=await readEffects(deps.db,intent);
    for(const effect of effects){
     if(effect.state!=='dispatching')continue;
     if(effect.kind==='cleanup'){await completeEffect(deps.db,intent,effect.effect_key,'pending',deps.clock.now(),'Interrupted cleanup can be retried idempotently');continue;}
     let state:string,reason:string|undefined;
     if(effect.request?.skip){state='succeeded';reason='Existing timeout was retained';}
     else if(effect.request?.blockedReason){state='blocked';reason=effect.request.blockedReason;}
     else {let found:'applied'|'not_applied'|'unknown'='unknown';try{found=await deps.port.lookupOutcome({...intent,...(effect.request?.until===undefined?{}:{requestedTimeoutUntil:effect.request.until})});}catch{/* Unavailable evidence is never proof of absence. */}state=found==='applied'?'succeeded':found==='not_applied'?'failed':'unknown';reason=found==='unknown'?'Interrupted punishment outcome is unknown; no automatic repeat':found==='not_applied'?'Evidence confirms the interrupted action was not applied':undefined;}
     await completeEffect(deps.db,intent,effect.effect_key,state,deps.clock.now(),reason);
    }
    if(!effects.length||(await readEffects(deps.db,intent)).some(effect=>effect.state==='pending'))await deps.db.query("UPDATE moderation_incidents SET state='pending',worker_id=NULL,dispatch_token=NULL,lease_until=NULL WHERE guild_id=$1 AND id=$2",[intent.guildId,intent.id]);
    else await finishIncident(deps.db,intent);
   }
  },
 };
}

