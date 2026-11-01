import {it,expect} from 'vitest';
import {withTestDb,seedGuild} from './database.js';
import type {AppDb} from '../src/db/client.js';
import {fakeClock} from './clock.js';
import {FeatureStatusRegistry} from '../src/core/status.js';
import {createSettingsService} from '../src/guilds/settings.js';
import {verificationDefaults} from '@eousbot/contracts';
import {createVerificationRepository} from '../src/features/verification/repository.js';
import {createVerificationService} from '../src/features/verification/service.js';
import type {ReactionEvent} from '../src/features/verification/ports.js';
import {FakeVerificationPort,verificationGuild as guild,verificationChannel as channel,verificationRole as role,verificationUser as user} from './verification-fixtures.js';
async function fixture(db:AppDb){
 await seedGuild(db,guild);await db.query('INSERT INTO guild_channels(guild_id,id,name,type) VALUES($1,$2,$3,$4)',[guild,channel,'verification','text']);
 const clock=fakeClock(1000),status=new FeatureStatusRegistry(clock),settings=createSettingsService(db,clock),port=new FakeVerificationPort();
 await settings.update(guild,'verification',{...verificationDefaults,enabled:true,channelId:channel,roleId:role},0,user);
 const repository=createVerificationRepository(db,clock);let service=createVerificationService({repository,port,clock,status});const panel=await service.setup(guild,channel,user);
 async function emit(messageId:string,kind:'add'|'remove',reactionType:'normal'|'burst'='normal',userId=user){const binding=(await repository.findBinding(guild,messageId))!;const event:ReactionEvent={guildId:guild,channelId:channel,messageId,userId,emojiKey:binding.emojiKey,kind,reactionType};port.observe(binding,event);await service.reactionChanged(event);}
 async function replace(roleId=role){const current=await settings.read(guild,'verification');await settings.update(guild,'verification',{...current.value,roleId},current.revision,user);return service.setup(guild,channel,user);}
 return {clock,status,settings,port,repository,panel,emit,replace,get service(){return service;},restart(){service=createVerificationService({repository:createVerificationRepository(db,clock),port,clock,status});return service;},has:(id:string,roleId=role)=>port.roles.get(guild+':'+id)?.has(roleId)??false};
}
it('second reaction page failure causes zero removals',()=>withTestDb(async db=>{
 const f=await fixture(db);await f.emit(f.panel.messageId,'add');const binding=(await f.repository.findBinding(guild,f.panel.messageId))!;
 f.port.reactors.set(f.port.key(binding,'normal'),new Set(Array.from({length:101},(_,i)=>String(500000000000000000n+BigInt(i)))));f.port.failPage='normal';
 const before=f.port.effects.filter(e=>e.kind==='remove').length,result=await f.restart().reconcile(guild);expect(result.complete).toBe(false);expect(f.has(user)).toBe(true);expect(f.port.effects.filter(e=>e.kind==='remove')).toHaveLength(before);
}));
it('complete pagination after reconstruction repairs missed adds and removals',()=>withTestDb(async db=>{
 const f=await fixture(db);await f.emit(f.panel.messageId,'add');const binding=(await f.repository.findBinding(guild,f.panel.messageId))!,other='444444444444444444';f.port.reactors.set(f.port.key(binding,'normal'),new Set([other]));
 const result=await f.restart().reconcile(guild);expect(result).toMatchObject({added:1,removed:1,complete:true});expect(f.has(user)).toBe(false);expect(f.has(other)).toBe(true);
}));
it('a missing panel pauses verification and preserves tracked roles, but remove-all on a valid panel revokes',()=>withTestDb(async db=>{
 const f=await fixture(db);await f.emit(f.panel.messageId,'add');f.port.reactors.clear();f.port.missing.add(f.panel.messageId);await f.service.reactionChanged({kind:'remove_all',guildId:guild,channelId:channel,messageId:f.panel.messageId});expect(f.has(user)).toBe(true);
 f.port.missing.clear();await f.service.reactionChanged({kind:'remove_all',guildId:guild,channelId:channel,messageId:f.panel.messageId});expect(f.has(user)).toBe(false);
}));
it('role replacement grants new access before removing a tracked old role',()=>withTestDb(async db=>{
 const f=await fixture(db);await f.emit(f.panel.messageId,'add');const nextRole='555555555555555555',replacement=await f.replace(nextRole);expect(f.has(user)).toBe(true);expect(f.has(user,nextRole)).toBe(false);
 await f.emit(replacement.messageId,'add');expect(f.port.effects.slice(-2).map(e=>[e.kind,e.roleId])).toEqual([['add',nextRole],['remove',role]]);expect(f.has(user,nextRole)).toBe(true);expect(f.has(user)).toBe(false);
}));
it('failed new grants preserve old access; failed old removals retry without undoing the new grant',()=>withTestDb(async db=>{
 const f=await fixture(db);await f.emit(f.panel.messageId,'add');const nextRole='555555555555555555',replacement=await f.replace(nextRole);f.port.failGrant=true;await f.emit(replacement.messageId,'add');expect(f.has(user)).toBe(true);expect(f.has(user,nextRole)).toBe(false);
 f.port.failGrant=false;f.port.failRemove=true;await f.service.reconcile(guild);expect(f.has(user)).toBe(true);expect(f.has(user,nextRole)).toBe(true);expect((await f.repository.assignments(guild,user)).some(row=>row.operation==='transfer_remove')).toBe(true);
 f.port.failRemove=false;await f.restart().reconcile(guild);expect(f.has(user)).toBe(false);expect(f.has(user,nextRole)).toBe(true);expect(f.port.effects.filter(e=>e.kind==='add'&&e.roleId===nextRole)).toHaveLength(1);
}));
it('a role that predated a tracked assignment is preserved through role replacement',()=>withTestDb(async db=>{
 const f=await fixture(db);f.port.roles.set(guild+':'+user,new Set([role]));await f.emit(f.panel.messageId,'add');const nextRole='555555555555555555',replacement=await f.replace(nextRole);await f.emit(replacement.messageId,'add');expect(f.has(user)).toBe(true);expect(f.has(user,nextRole)).toBe(true);expect(f.port.effects.filter(e=>e.kind==='remove'&&e.roleId===role)).toEqual([]);
}));
it('retired panels accept no new verification but their tracked removals still revoke old access',()=>withTestDb(async db=>{
 const f=await fixture(db);await f.emit(f.panel.messageId,'add');await f.replace('555555555555555555');await f.emit(f.panel.messageId,'add','normal','444444444444444444');expect(f.has('444444444444444444')).toBe(false);await f.emit(f.panel.messageId,'remove');expect(f.has(user)).toBe(false);
}));
it('same-role generations retain access until the last valid reaction is removed',()=>withTestDb(async db=>{
 const f=await fixture(db);await f.emit(f.panel.messageId,'add');const replacement=await f.replace();await f.emit(replacement.messageId,'add');await f.emit(replacement.messageId,'remove');expect(f.has(user)).toBe(true);await f.emit(f.panel.messageId,'remove');expect(f.has(user)).toBe(false);
}));
it('missing retired panels preserve their outstanding assignments',()=>withTestDb(async db=>{
 const f=await fixture(db);await f.emit(f.panel.messageId,'add');await f.replace('555555555555555555');f.port.missing.add(f.panel.messageId);const result=await f.restart().reconcile(guild);expect(result.complete).toBe(false);expect(f.has(user)).toBe(true);
}));
it('ambiguous panel sends recover across repository reconstruction without duplicate posts',()=>withTestDb(async db=>{
 const f=await fixture(db);f.port.throwAfterSend=true;await expect(f.service.setup(guild,channel,user)).rejects.toThrow();const sent=f.port.posts;f.port.throwAfterSend=false;const recovered=await f.restart().setup(guild,channel,user);expect(recovered.generation).toBe(2);expect(f.port.posts).toBe(sent);expect((await f.repository.listBindings(guild)).filter(b=>b.active)).toHaveLength(1);
}));
it('lost role permissions produce a degraded state and a durable retry',()=>withTestDb(async db=>{
 const f=await fixture(db);f.port.denyRole=true;await f.emit(f.panel.messageId,'add');expect(f.has(user)).toBe(false);expect((await f.repository.assignments(guild,user))[0]?.operation).toBe('grant');expect(f.status.list(guild)).toEqual(expect.arrayContaining([expect.objectContaining({state:'degraded'})]));
}));
it('replacement during an unfinished grant preserves the authorized retired assignment',()=>withTestDb(async db=>{
 const f=await fixture(db);let resume=()=>{},entered=()=>{};const pending=new Promise<void>(r=>{resume=r;}),started=new Promise<void>(r=>{entered=r;}),original=f.port.addRole.bind(f.port);
 f.port.addRole=async(...args)=>{entered();await pending;return original(...args);};const granting=f.emit(f.panel.messageId,'add');await started;await f.replace();resume();await granting;await f.restart().reconcile(guild);expect(f.has(user)).toBe(true);
}));

it('a delayed old-panel event cannot create a new retired assignment',()=>withTestDb(async db=>{
 const f=await fixture(db),other='444444444444444444';let resume=()=>{},entered=()=>{};const gate=new Promise<void>(r=>{resume=r;}),started=new Promise<void>(r=>{entered=r;}),original=f.port.memberRoleState.bind(f.port);let waiting=true;
 f.port.memberRoleState=async(...args)=>{if(waiting&&args[1]===other){waiting=false;entered();await gate;}return original(...args);};
 const delayed=f.emit(f.panel.messageId,'add','normal',other);await started;await f.replace();resume();await delayed;expect(await f.repository.assignments(guild,other)).toEqual([]);expect(f.has(other)).toBe(false);
}));

it('guild-scoped assignments and composite role references remain isolated',()=>withTestDb(async db=>{
 const f=await fixture(db);await f.emit(f.panel.messageId,'add');const second='9223372036854775808',secondChannel='666666666666666666',secondRole='777777777777777777';await seedGuild(db,second);await db.query('INSERT INTO guild_channels(guild_id,id,name,type) VALUES($1,$2,$3,$4)',[second,secondChannel,'verification B','text']);
 await f.settings.update(second,'verification',{...verificationDefaults,enabled:true,channelId:secondChannel,roleId:secondRole},0,user);const created=await f.service.setup(second,secondChannel,user),binding=(await f.repository.findBinding(second,created.messageId))!,event:ReactionEvent={kind:'add',guildId:second,channelId:secondChannel,messageId:created.messageId,userId:user,emojiKey:binding.emojiKey,reactionType:'normal'};f.port.observe(binding,event);await f.service.reactionChanged(event);
 expect(f.has(user)).toBe(true);expect(f.port.roles.get(second+':'+user)?.has(secondRole)).toBe(true);const original=(await f.repository.assignments(guild,user))[0]!;
 await expect(f.repository.saveAssignment({...original,guildId:second})).rejects.toMatchObject({cause:{code:'23503'}});expect((await f.repository.assignments(second,user))[0]!.roleId).toBe(secondRole);
}));
it('a reaction arriving during reconciliation cannot be overwritten by its older empty snapshot',()=>withTestDb(async db=>{
 const f=await fixture(db);await f.emit(f.panel.messageId,'add');f.port.reactors.clear();const original=f.port.listReactors.bind(f.port);let inject=true;
 f.port.listReactors=async(...args)=>{const response=await original(...args);if(inject){inject=false;await f.emit(f.panel.messageId,'add');}return response;};
 const result=await f.service.reconcile(guild);expect(result.complete).toBe(false);expect(f.has(user)).toBe(true);expect(f.port.effects.filter(effect=>effect.kind==='remove')).toHaveLength(0);
}));
