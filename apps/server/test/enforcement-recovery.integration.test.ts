import {it,expect} from 'vitest';
import {withTestDb} from './database.js';
import {fakeClock} from './clock.js';
import {incident,blockCompletion} from './enforcement-fixtures.js';
import {FakeModerationPort} from './moderation-port.js';
import {seedRule} from './protection-fixtures.js';
import {createProtectionEngine} from '../src/features/protection/engine.js';
import {message} from './message.js';
import {createEnforcementService} from '../src/features/moderation/enforcement.js';
import {createRecoveryService} from '../src/features/moderation/recovery.js';
const related={async list(){return [];}};
it.each(['applied','unknown'] as const)('accepted timeout then DB failure reconciles as %s without a second action',lookup=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock),port=new FakeModerationPort(db);await blockCompletion(db);
 await expect(createEnforcementService({db,clock,port,related}).dispatch(intent.id)).rejects.toThrow();expect(port.calls.filter(c=>c.kind==='timeout')).toHaveLength(1);
 await db.query('DROP TRIGGER completion_failure ON incident_effects');clock.advance(60001);port.lookup=lookup;
 await createRecoveryService({db,clock,port}).recoverPending();const outcome=(await db.query('SELECT outcome FROM moderation_cases WHERE id=$1',[intent.id])).rows[0].outcome;expect(outcome.punishment.state).toBe(lookup==='applied'?'succeeded':'unknown');expect(port.calls.filter(c=>c.kind==='timeout')).toHaveLength(1);
}));
it.each(['kick','ban'] as const)('ambiguous %s stays unknown and never repeats automatically',kind=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock,{kind}),port=new FakeModerationPort(db);port.ambiguousPunish=true;port.lookup='unknown';
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);expect(result.state).toBe('unknown');clock.advance(60001);await createRecoveryService({db,clock,port}).recoverPending();expect(port.calls.filter(c=>c.kind===kind)).toHaveLength(1);
}));
it('a changed Ban contributor cancels all combined work even when Timeout remains valid',()=>withTestDb(async db=>{
 const clock=fakeClock(1000);await seedRule(db,{action:{kind:'timeout',durationSeconds:60},threshold:{count:1,windowSeconds:10}});const ban=await seedRule(db,{action:{kind:'ban'},threshold:{count:1,windowSeconds:10}});
 const engine=createProtectionEngine(db,clock);const result=await engine.observe(message({content:'https://example.org',createdAt:1000}));await db.query('UPDATE channel_rules SET revision=revision+1 WHERE id=$1',[ban.id]);const port=new FakeModerationPort(db);
 const outcome=await createEnforcementService({db,clock,port,related}).dispatch(result.incidentId!);expect(outcome.state).toBe('cancelled');expect(port.calls).toEqual([]);
}));
it('config changes after dispatched cleanup preserve completed counts and cancel pending punishment',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent,rule}=await incident(db,clock,{kind:'ban'},6),port=new FakeModerationPort(db);let inspectCount=0;let resume=()=>{};
 port.onInspect=async()=>{inspectCount++;if(inspectCount===1)await new Promise<void>(r=>{resume=r;});};
 let changed=false;port.onDeleted=async()=>{if(!changed){changed=true;await db.query('UPDATE channel_rules SET revision=revision+1 WHERE id=$1',[rule.id]);resume();}};
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);expect(result.cleanup.deleted).toBeGreaterThan(0);expect(result.cleanup.deleted).toBeLessThanOrEqual(5);expect(result.punishment.state).toBe('cancelled');expect(port.calls.filter(c=>c.kind==='ban')).toEqual([]);expect(result.state).toBe('cancelled');
}));


it('direct restart dispatch retains a public unknown outcome without repeating a started punishment',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock),port=new FakeModerationPort(db);await blockCompletion(db);
 await expect(createEnforcementService({db,clock,port,related}).dispatch(intent.id)).rejects.toThrow();await db.query('DROP TRIGGER completion_failure ON incident_effects');clock.advance(60001);
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);expect(result.punishment.state).toBe('unknown');expect(port.calls.filter(c=>c.kind==='timeout')).toHaveLength(1);
}));
it('new role exemptions cancel pending cleanup-only work during cooldown',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent,rule}=await incident(db,clock),port=new FakeModerationPort(db);await createEnforcementService({db,clock,port,related}).dispatch(intent.id);
 clock.advance(1000);const {incidentId}=await createProtectionEngine(db,clock).observe(message({id:'444444444444444444',content:'https://example.org',createdAt:clock.now()}));
 const stored=(await db.query('SELECT config FROM channel_rules WHERE id=$1',[rule.id])).rows[0].config;stored.exemptRoleIds=['222222222222222222'];await db.query('UPDATE channel_rules SET config=$2,revision=revision+1 WHERE id=$1',[rule.id,stored]);port.target.roleIds=['222222222222222222'];
 const before=port.calls.length,result=await createEnforcementService({db,clock,port,related}).dispatch(incidentId!);expect(result.state).toBe('cancelled');expect(port.calls).toHaveLength(before);
}));

it('a late failed inspection cannot overwrite a cancellation committed by another batch',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent,rule}=await incident(db,clock,{kind:'ban'},6),port=new FakeModerationPort(db);let inspections=0,changed=false;
 port.onInspect=async()=>{if(++inspections!==1)return;const until=Date.now()+2000;while(Date.now()<until){const state=(await db.query('SELECT state FROM incident_effects WHERE incident_id=$1 AND effect_key=$2',[intent.id,'punishment'])).rows[0]?.state;if(state==='cancelled')throw new Error('Late inspection failure');await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('Cancellation was not observed');};
 port.onDelete=async()=>{if(!changed){changed=true;await db.query('UPDATE channel_rules SET revision=revision+1 WHERE id=$1',[rule.id]);}};
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);expect(result.punishment.state).toBe('cancelled');expect(port.calls.filter(c=>c.kind==='ban')).toHaveLength(0);
}));
