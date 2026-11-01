import {it,expect} from 'vitest';
import {withTestDb} from './database.js';
import {fakeClock} from './clock.js';
import {seedRule,intents} from './protection-fixtures.js';
import {createSettingsService} from '../src/guilds/settings.js';
import {automodDefaults} from '@eousbot/contracts';
import {createGeneralAutoMod,createProtectionStage} from '../src/features/automod/service.js';
import {createProtectionEngine} from '../src/features/protection/engine.js';
import {createRuleRepository} from '../src/features/protection/repository.js';
import {message} from './message.js';
const owner='123456789012345678',guild='9223372036854775807';
it('protected channels never run immediate general deletion and disabling the last rule restores it',()=>withTestDb(async db=>{
 const rule=await seedRule(db);const clock=fakeClock(1000);await createSettingsService(db,clock).update(guild,'automod',{...automodDefaults,enabled:true,blockLinks:true},0,owner);
 const general=createGeneralAutoMod(db,clock),stage=createProtectionStage(createProtectionEngine(db,clock),general,createRuleRepository(db));
 for(let i=1;i<=2;i++){expect(await stage(message({id:String(333333333333333300n+BigInt(i)),content:'https://example.org',createdAt:1000}))).toMatchObject({kind:'held'});expect(await intents(db)).toHaveLength(0);}
 await stage(message({id:'333333333333333303',content:'https://example.org',createdAt:1000}));expect((await intents(db))[0]!.source).toBe('channel_rule');
 await db.query('UPDATE channel_rules SET enabled=false,revision=revision+1 WHERE id=$1',[rule.id]);
 expect(await stage(message({id:'333333333333333304',content:'https://example.org',createdAt:1000}))).toMatchObject({kind:'delete'});expect((await intents(db)).some(i=>i.source==='general_automod')).toBe(true);
}));
it('general violation windows survive reconstruction and duplicate messages do not escalate',()=>withTestDb(async db=>{
 await seedRule(db,{enabled:false});const clock=fakeClock(1000);await createSettingsService(db,clock).update(guild,'automod',{...automodDefaults,enabled:true,blockLinks:true,violations:{count:2,windowSeconds:60}},0,owner);
 let general=createGeneralAutoMod(db,clock);const first=message({content:'https://example.org',createdAt:1000});await general.evaluate(first);await general.evaluate(first);expect((await intents(db)).filter(i=>i.action)).toHaveLength(0);
 general=createGeneralAutoMod(db,clock);await general.evaluate({...first,id:'444444444444444444'});expect((await intents(db)).filter(i=>i.action)).toHaveLength(1);
}));


it('edited general policy cancels its queued punishment and cleanup together',()=>withTestDb(async db=>{
 await seedRule(db,{enabled:false});const clock=fakeClock(1000),settings=createSettingsService(db,clock),config={...automodDefaults,enabled:true,blockLinks:true,violations:{count:1,windowSeconds:60},action:{kind:'ban' as const}};
 await settings.update(guild,'automod',config,0,owner);const result=await createGeneralAutoMod(db,clock).evaluate(message({content:'https://example.org',createdAt:1000}));await settings.update(guild,'automod',{...config,enabled:false},1,owner);
 const {FakeModerationPort}=await import('./moderation-port.js'),{createEnforcementService}=await import('../src/features/moderation/enforcement.js');const port=new FakeModerationPort(db);
 const outcome=await createEnforcementService({db,clock,port,related:{async list(){return [];}}}).dispatch(result.incidentId!);expect(outcome.state).toBe('cancelled');expect(port.calls).toEqual([]);
}));

it('general cases preserve the original policy snapshot after later edits',()=>withTestDb(async db=>{
 await seedRule(db,{enabled:false});const clock=fakeClock(1000),settings=createSettingsService(db,clock),config={...automodDefaults,enabled:true,blockLinks:true,violations:{count:1,windowSeconds:60}};await settings.update(guild,'automod',config,0,owner);
 const result=await createGeneralAutoMod(db,clock).evaluate(message({content:'https://example.org',createdAt:1000}));await settings.update(guild,'automod',{...config,violations:{count:9,windowSeconds:120}},1,owner);
 const {createCaseRepository}=await import('../src/features/moderation/cases.js');const recorded=await createCaseRepository(db).get(guild,result.incidentId!);expect(recorded).toMatchObject({policySnapshot:{revision:1,value:{violations:{count:1,windowSeconds:60}}}});
}));
it('rule activation between pipeline routing and locked evaluation preserves the first match',()=>withTestDb(async db=>{await seedRule(db,{enabled:false});const clock=fakeClock(1000);await createSettingsService(db,clock).update(guild,'automod',{...automodDefaults,enabled:true,blockLinks:true,violations:{count:1,windowSeconds:60}},0,owner);const repository=createRuleRepository(db),stage=createProtectionStage(createProtectionEngine(db,clock),createGeneralAutoMod(db,clock),{...repository,async hasEnabledInChannel(){await db.query('UPDATE channel_rules SET enabled=true,revision=revision+1 WHERE guild_id=$1',[guild]);return false;}});expect(await stage(message({content:'https://example.org',createdAt:1000}))).toMatchObject({kind:'held'});expect(await intents(db)).toHaveLength(0);}));
it('new channel protection cancels queued general AutoMod punishment and cleanup',()=>withTestDb(async db=>{await seedRule(db,{enabled:false});const clock=fakeClock(1000);await createSettingsService(db,clock).update(guild,'automod',{...automodDefaults,enabled:true,blockLinks:true,violations:{count:1,windowSeconds:60},action:{kind:'ban'}},0,owner);const result=await createGeneralAutoMod(db,clock).evaluate(message({content:'https://example.org',createdAt:1000}));await db.query('UPDATE channel_rules SET enabled=true,revision=revision+1 WHERE guild_id=$1',[guild]);const {FakeModerationPort}=await import('./moderation-port.js'),{createEnforcementService}=await import('../src/features/moderation/enforcement.js'),port=new FakeModerationPort(db);const outcome=await createEnforcementService({db,clock,port,related:{list:async()=>[]}}).dispatch(result.incidentId!);expect(outcome.state).toBe('cancelled');expect(port.calls).toEqual([]);}));
