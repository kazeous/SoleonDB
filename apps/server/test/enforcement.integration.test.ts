import {it,expect} from 'vitest';
import {withTestDb} from './database.js';
import {fakeClock} from './clock.js';
import {incident} from './enforcement-fixtures.js';
import {FakeModerationPort} from './moderation-port.js';
import {createEnforcementService} from '../src/features/moderation/enforcement.js';
const related={async list(){return [];}};
it('admin timeout is blocked while cleanup succeeds and the actual outcome is durable',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock),port=new FakeModerationPort(db);port.target.isAdministrator=true;
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);
 expect(result.punishment.state).toBe('blocked');expect(result.cleanup.deleted).toBe(1);expect(result.state).toBe('partial');expect(port.calls.map(c=>c.kind)).toEqual(['delete']);expect((await db.query('SELECT outcome FROM moderation_cases')).rows[0].outcome).toEqual(result);
}));
it.each([{kind:'kick' as const,isOwner:true},{kind:'ban' as const,botCanBan:false},{kind:'kick' as const,botCanKick:false}])('blocks owner/hierarchy action %o without escalation',data=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock,{kind:data.kind}),port=new FakeModerationPort(db);Object.assign(port.target,data);
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);expect(result.punishment.state).toBe('blocked');expect(port.calls.filter(c=>c.kind!=='delete')).toEqual([]);
}));
it('never shortens an existing timeout',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock),port=new FakeModerationPort(db);port.target.timeoutUntil=1000000;
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);expect(result.punishment.state).toBe('succeeded');expect(port.calls.filter(c=>c.kind==='timeout')).toEqual([]);
}));
it.each(['delete','punish'])('failure in %s does not suppress the other effect',failure=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock),port=new FakeModerationPort(db);port.failDelete=failure==='delete';port.failPunish=failure==='punish';
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);expect(result.state).toBe('partial');expect(result.punishment.state).toBe(failure==='delete'?'succeeded':'failed');expect(result.cleanup.deleted).toBe(failure==='delete'?0:1);
}));
it('missing messages are successful no-ops and Ban has no historical purge argument',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock,{kind:'ban'}),port=new FakeModerationPort(db);port.missing.add(intent.cleanupMessages[0]!.messageId);
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);expect(result.cleanup).toEqual({deleted:0,missing:1,failed:0});expect(result.state).toBe('succeeded');expect(port.calls.find(c=>c.kind==='ban')).toEqual({kind:'ban',guildId:intent.guildId,userId:intent.userId,reason:expect.stringContaining(intent.id)});
}));
it('cleanup concurrency is bounded at five and duplicate dispatch does not repeat punishment',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock,{kind:'timeout',durationSeconds:60},10),port=new FakeModerationPort(db),service=createEnforcementService({db,clock,port,related});
 await Promise.all([service.dispatch(intent.id),service.dispatch(intent.id)]);expect(port.maximumDeletes).toBeLessThanOrEqual(5);expect(port.deleted.size).toBe(10);expect(port.calls.filter(c=>c.kind==='timeout')).toHaveLength(1);
}));


it('unavailable inspection fails all unsent cleanup explicitly',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock,{kind:'timeout',durationSeconds:60},6),port=new FakeModerationPort(db);port.onInspect=async()=>{throw new Error('Discord unavailable');};
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);expect(result.state).toBe('failed');expect(result.cleanup.failed).toBe(6);expect(port.calls).toEqual([]);
}));
it('punishment is dispatched while cleanup waits for a slow external operation',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock),port=new FakeModerationPort(db);let announce=()=>{};const punished=new Promise<void>(r=>{announce=r;});const original=port.timeout.bind(port);
 port.timeout=async(...args)=>{await original(...args);announce();};port.onDelete=async()=>punished;
 const result=await createEnforcementService({db,clock,port,related}).dispatch(intent.id);expect(result.punishment.state).toBe('succeeded');expect(result.cleanup.deleted).toBe(1);
}));
it('transaction context guard rejects network work inside its own transaction only',()=>withTestDb(async db=>{
 const {withTransaction,assertOutsideTransaction}=await import('../src/db/client.js');
 await withTransaction(db,async()=>{expect(()=>assertOutsideTransaction()).toThrow(/SQL transaction/);});expect(()=>assertOutsideTransaction()).not.toThrow();
}));
