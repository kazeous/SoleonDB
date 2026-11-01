import {it,expect} from 'vitest';
import {withTestDb,seedGuild} from './database.js';
import {fakeClock} from './clock.js';
import {FakeModerationPort} from './moderation-port.js';
import {createEnforcementService} from '../src/features/moderation/enforcement.js';
import {createModerationActions} from '../src/features/moderation/actions.js';
import {createCleanService} from '../src/features/moderation/clean.js';
import {assertCommandAuthority} from '../src/features/moderation/commands.js';
const guild='9223372036854775807',actor='123456789012345678',target='222222222222222222';
function authority(){return {async inspect(guildId:string,actorId:string,targetId:string|null){return {guildId,actorId,targetId,ownerId:'999999999999999999',botId:'888888888888888888',actorPermissions:'8198',actorPosition:5,botPosition:10,targetPosition:1};}};}
it('warnings are real cases and repeated interaction IDs never repeat Ban after reconstruction',()=>withTestDb(async db=>{
 await seedGuild(db,guild);const clock=fakeClock(1000),port=new FakeModerationPort(db),auth=authority(),enforcement=createEnforcementService({db,clock,port,related:{async list(){return [];}}});
 let actions=createModerationActions({db,clock,authority:auth,enforcement});const warning=await actions.request({guildId:guild,actorId:actor,targetId:target,command:'warn',reason:'A warning',operationKey:'warn-1'});expect(warning.action).toBe('warn');expect(warning.outcome?.state).toBe('succeeded');expect(port.calls).toEqual([]);
 const request={guildId:guild,actorId:actor,targetId:target,command:'ban' as const,reason:'Reason',operationKey:'ban-1'};const first=await actions.request(request);actions=createModerationActions({db,clock,authority:auth,enforcement});const duplicate=await actions.request(request);expect(duplicate.id).toBe(first.id);expect(port.calls.filter(c=>c.kind==='ban')).toHaveLength(1);expect((await db.query('SELECT 1 FROM moderation_cases')).rowCount).toBe(2);
}));
it('lost actor permission at dispatch is recorded as blocked without punishment',()=>withTestDb(async db=>{
 await seedGuild(db,guild);const clock=fakeClock(1000),port=new FakeModerationPort(db);let checks=0;const initial=authority();const auth={async inspect(...args:Parameters<typeof initial.inspect>){const state=await initial.inspect(...args);return {...state,actorPermissions:++checks===1?'4':'0'};}};
 const enforcement=createEnforcementService({db,clock,port,related:{async list(){return [];}},authorizeCommand:async intent=>assertCommandAuthority(intent.command!,await auth.inspect(intent.guildId,intent.actorId!,intent.userId))});
 const actions=createModerationActions({db,clock,authority:auth,enforcement});const result=await actions.request({guildId:guild,actorId:actor,targetId:target,command:'ban',reason:'Reason',operationKey:'ban-revoked'});expect(result.outcome?.punishment.state).toBe('blocked');expect(port.calls).toEqual([]);
}));
it('manual cleanup persists its actual selected, skipped and failed result',()=>withTestDb(async db=>{
 await seedGuild(db,guild);const clock=fakeClock(2000000000000),port=new FakeModerationPort(db),auth=authority(),enforcement=createEnforcementService({db,clock,port,related:{async list(){return [];}}});
 const clean=createCleanService({db,clock,authority:auth,enforcement,port:{async list(guildId,channelId){return [{id:'333333333333333333',guildId,channelId,authorId:target,bot:true,content:'hello',createdAt:clock.now(),attachmentCount:0,embedCount:0},{id:'444444444444444444',guildId,channelId,authorId:target,bot:false,content:'hello',createdAt:clock.now(),attachmentCount:0,embedCount:0}];}}});
 const result=await clean.run({guildId:guild,channelId:'111111111111111111',actorId:actor,operationKey:'clean-1',amount:100,filter:'only-bots'});expect(result).toMatchObject({deleted:1,skipped:1,failed:0,caseNumber:1});expect((await db.query('SELECT action,outcome FROM moderation_cases')).rows[0]).toMatchObject({action:'clean',outcome:{cleanup:{deleted:1}}});
}));

it('bounded mention-safe warning reasons remain accepted at the input limit',()=>withTestDb(async db=>{
 await seedGuild(db,guild);const clock=fakeClock(1000),port=new FakeModerationPort(db),auth=authority(),enforcement=createEnforcementService({db,clock,port,related:{async list(){return [];}}});
 const actions=createModerationActions({db,clock,authority:auth,enforcement});const result=await actions.request({guildId:guild,actorId:actor,targetId:target,command:'warn',reason:'@'.repeat(512),operationKey:'warn-maximum'});expect(result.reason.length).toBeLessThanOrEqual(512);expect(result.reason).not.toContain('@@');
}));
