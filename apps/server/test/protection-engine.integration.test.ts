import {it,expect} from 'vitest';
import {withTestDb} from './database.js';
import {fakeClock} from './clock.js';
import {message} from './message.js';
import {seedRule,intents} from './protection-fixtures.js';
import {createProtectionEngine} from '../src/features/protection/engine.js';
const user='123456789012345678';
function msg(id:number,time:number,patch:Partial<ReturnType<typeof message>>={}){return message({id:String(333333333333333300n+BigInt(id)),content:'https://example.org',createdAt:time,...patch});}
it('N-1 has no effects and N creates one durable intent despite concurrent duplicate events',()=>withTestDb(async db=>{
 await seedRule(db);const clock=fakeClock(1000),engine=createProtectionEngine(db,clock);
 await engine.observe(msg(1,1000));await engine.observe(msg(2,1000));expect(await intents(db)).toHaveLength(0);
 const results=await Promise.all([engine.observe(msg(3,1000)),engine.observe(msg(3,1000))]);expect(await intents(db)).toHaveLength(1);expect(results.some(r=>r.kind==='delete')).toBe(true);
 await engine.observe(msg(3,1000));expect(await intents(db)).toHaveLength(1);expect((await db.query('SELECT 1 FROM moderation_cases')).rowCount).toBe(1);
}));
it('uses surviving first matches after service reconstruction',()=>withTestDb(async db=>{
 await seedRule(db);const clock=fakeClock(1000);let engine=createProtectionEngine(db,clock);
 await engine.observe(msg(1,1000));clock.advance(8000);await engine.observe(msg(2,9000));expect(await intents(db)).toHaveLength(0);
 engine=createProtectionEngine(db,clock);clock.advance(1000);await engine.observe(msg(3,10000));expect(await intents(db)).toHaveLength(1);
}));
it('excludes T-W exactly but counts T-W+1',()=>withTestDb(async db=>{
 await seedRule(db);const clock=fakeClock(0),engine=createProtectionEngine(db,clock);
 await engine.observe(msg(1,0));clock.advance(1);await engine.observe(msg(2,1));clock.advance(9999);await engine.observe(msg(3,10000));expect(await intents(db)).toHaveLength(0);await engine.observe(msg(4,10000));expect(await intents(db)).toHaveLength(1);
}));
it('edits count newly matching once, never decrement and ignore old messages',()=>withTestDb(async db=>{
 await seedRule(db);const clock=fakeClock(10001),engine=createProtectionEngine(db,clock);
 const original=msg(1,10000,{content:'plain'});await engine.observe(original);
 await engine.observe({...original,content:'https://example.org',editedAt:10000});await engine.observe({...original,content:'https://example.org/again',editedAt:10000});await engine.observe({...original,content:'plain',editedAt:10000});
 await engine.observe(msg(2,0,{editedAt:10000}));await engine.observe(msg(3,10000));expect(await intents(db)).toHaveLength(0);await engine.observe(msg(4,10000));expect(await intents(db)).toHaveLength(1);
}));
it('isolates guild, channel and member counters even for shared IDs',()=>withTestDb(async db=>{
 await seedRule(db);await seedRule(db,{guildId:'9223372036854775808'});await seedRule(db,{channelId:'222222222222222222'});
 const clock=fakeClock(1000),engine=createProtectionEngine(db,clock);
 for(let i=1;i<=2;i++){await engine.observe(msg(i,1000));await engine.observe(msg(i+10,1000,{guildId:'9223372036854775808'}));await engine.observe(msg(i+20,1000,{channelId:'222222222222222222'}));await engine.observe(msg(i+30,1000,{userId:'999999999999999999'}));}
 expect(await intents(db)).toHaveLength(0);await engine.observe(msg(3,1000));expect(await intents(db)).toHaveLength(1);
}));
it('cooldown persists, fresh thresholds clean only, expiry alone does not punish',()=>withTestDb(async db=>{
 await seedRule(db);const clock=fakeClock(1000);let engine=createProtectionEngine(db,clock);
 for(let i=1;i<=3;i++)await engine.observe(msg(i,clock.now()));const parent=(await intents(db))[0]!;clock.advance(1000);engine=createProtectionEngine(db,clock);
 for(let i=4;i<=5;i++)await engine.observe(msg(i,clock.now()));expect(await intents(db)).toHaveLength(1);await engine.observe(msg(6,clock.now()));
 const cleanup=(await intents(db)).find(i=>i.mode==='cleanup_only')!;expect(cleanup.parentIncidentId).toBe(parent.id);expect(cleanup.action).toBeNull();expect(cleanup.cleanupMessages.map(m=>m.messageId)).toEqual(['333333333333333304','333333333333333305','333333333333333306']);
 clock.advance(30000);expect(await intents(db)).toHaveLength(2);for(let i=7;i<=9;i++)await engine.observe(msg(i,clock.now()));expect((await intents(db)).filter(i=>i.mode==='punish')).toHaveLength(2);
}));
it('combined crossings choose one strongest action and deduplicate their cleanup union',()=>withTestDb(async db=>{
 await seedRule(db,{threshold:{count:2,windowSeconds:10},action:{kind:'timeout',durationSeconds:60}});await seedRule(db,{threshold:{count:2,windowSeconds:10},action:{kind:'ban'}});
 const clock=fakeClock(1000),engine=createProtectionEngine(db,clock);await engine.observe(msg(1,1000));await engine.observe(msg(2,1000));const [intent]=await intents(db);expect(intent!.action).toEqual({kind:'ban'});expect(intent!.contributors).toHaveLength(2);expect(intent!.cleanupMessages).toHaveLength(2);
}));
it('rule revisions reset windows and failed incident insert leaves no dispatchable work',()=>withTestDb(async db=>{
 const rule=await seedRule(db);const clock=fakeClock(1000),engine=createProtectionEngine(db,clock);await engine.observe(msg(1,1000));await engine.observe(msg(2,1000));await db.query('UPDATE channel_rules SET revision=revision+1 WHERE id=$1',[rule.id]);await engine.observe(msg(3,1000));expect(await intents(db)).toHaveLength(0);
 await db.query('ALTER TABLE moderation_incidents ADD CONSTRAINT simulate_failure CHECK (false) NOT VALID');await engine.observe(msg(4,1000));await expect(engine.observe(msg(5,1000))).rejects.toThrow();expect(await intents(db)).toHaveLength(0);expect((await db.query('SELECT 1 FROM moderation_cases')).rowCount).toBe(0);
}));


it('queue claims are exclusive and guild case numbers stay local',()=>withTestDb(async db=>{
 await seedRule(db,{threshold:{count:1,windowSeconds:10}});await seedRule(db,{guildId:'9223372036854775808',threshold:{count:1,windowSeconds:10}});
 const clock=fakeClock(1000),engine=createProtectionEngine(db,clock);await engine.observe(msg(1,1000));await engine.observe(msg(2,1000,{guildId:'9223372036854775808'}));
 const {createIncidentRepository}=await import('../src/features/moderation/incidents.js');const queue=createIncidentRepository(db);
 const claims=await Promise.all([queue.claimNext('a',1000),queue.claimNext('b',1000),queue.claimNext('c',1000)]);expect(claims.filter(Boolean)).toHaveLength(2);expect(new Set(claims.filter(Boolean).map(i=>i!.id)).size).toBe(2);
 const {createCaseRepository}=await import('../src/features/moderation/cases.js');const cases=createCaseRepository(db);const local=await cases.list('9223372036854775807');expect(local.items.map(c=>c.number)).toEqual([1]);expect((await cases.list('9223372036854775808')).items.map(c=>c.number)).toEqual([1]);
}));
it('bounded pruning removes expired metadata while retaining incident message history',()=>withTestDb(async db=>{
 await seedRule(db,{threshold:{count:1,windowSeconds:1}});const clock=fakeClock(1000),engine=createProtectionEngine(db,clock);await engine.observe(msg(1,1000));clock.advance(1000);
 const {createObservationRepository}=await import('../src/features/protection/observations.js');await createObservationRepository(db).prune(clock.now(),1000);
 expect((await db.query('SELECT 1 FROM rule_matches')).rowCount).toBe(0);expect((await intents(db))[0]!.cleanupMessages).toEqual([{channelId:'111111111111111111',messageId:'333333333333333301'}]);
}));
