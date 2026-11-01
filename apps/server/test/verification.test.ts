import {it,expect} from 'vitest';
import {createVerificationService} from '../src/features/verification/service.js';
import {normalizeEmoji} from '@eousbot/contracts';
import {fakeClock} from './clock.js';
import {FeatureStatusRegistry} from '../src/core/status.js';
import {MemoryVerificationRepository,FakeVerificationPort,reaction,verificationUser,verificationRole,verificationGuild} from './verification-fixtures.js';
function fixture(){const repository=new MemoryVerificationRepository(),port=new FakeVerificationPort(),clock=fakeClock(1000),status=new FeatureStatusRegistry(clock),service=createVerificationService({repository,port,clock,status});return {repository,port,service,status,async emit(event:ReturnType<typeof reaction>){port.observe(repository.bindings[0]!,event);await service.reactionChanged(event);}};}
it('exact active panel grants and matching removal revokes the verified role',async()=>{const f=fixture();await f.emit(reaction('add'));expect(f.port.roles.get(verificationGuild+':'+verificationUser)?.has(verificationRole)).toBe(true);await f.emit(reaction('remove'));expect(f.port.roles.get(verificationGuild+':'+verificationUser)?.has(verificationRole)).toBe(false);});
it('normal and burst reactions form a union',async()=>{const f=fixture();await f.emit(reaction('add','normal'));await f.emit(reaction('add','burst'));await f.emit(reaction('remove','normal'));expect(f.port.effects.filter(e=>e.kind==='remove')).toEqual([]);await f.emit(reaction('remove','burst'));expect(f.port.effects.filter(e=>e.kind==='remove')).toEqual([{kind:'remove',guildId:verificationGuild,userId:verificationUser,roleId:verificationRole}]);});
it.each([{messageId:'444444444444444444'},{guildId:'9223372036854775808'},{channelId:'444444444444444444'},{emojiKey:'unicode:❌'}])('forged or mismatched panel event %o cannot grant access',async patch=>{const f=fixture();await f.service.reactionChanged({...reaction('add'),...patch});expect(f.port.effects).toEqual([]);});
it('bot reactions never grant access',async()=>{const f=fixture();f.port.bots.add(verificationUser);await f.emit(reaction('add'));expect(f.port.effects).toEqual([]);});
it('normalizes custom emoji by ID and Unicode by its visual sequence',()=>{expect(normalizeEmoji('<:name:123456789012345678>').key).toBe('custom:123456789012345678');expect(normalizeEmoji('<a:other:123456789012345678>').key).toBe('custom:123456789012345678');expect(normalizeEmoji('✅').key).toBe('unicode:✅');expect(()=>normalizeEmoji('not an emoji')).toThrow();});
it('missing active panel preserves roles and surfaces repair guidance',async()=>{const f=fixture();await f.emit(reaction('add'));f.port.missing.add(f.repository.bindings[0]!.messageId!);await f.emit(reaction('remove'));expect(f.port.roles.get(verificationGuild+':'+verificationUser)?.has(verificationRole)).toBe(true);expect(f.status.list(verificationGuild)).toEqual(expect.arrayContaining([expect.objectContaining({state:'degraded'})]));});
it('ambiguous panel creation retries recover the registered message without posting twice',async()=>{const f=fixture();f.port.throwAfterSend=true;await expect(f.service.setup(verificationGuild,f.repository.settings.channelId!,verificationUser)).rejects.toThrow();f.port.throwAfterSend=false;const result=await f.service.setup(verificationGuild,f.repository.settings.channelId!,verificationUser);expect(result.messageId).toBe('1000000000000000001');expect(f.port.posts).toBe(1);});

it('role selection rejects privileged, managed, foreign and unmanageable roles',async()=>{
 const {assertAssignableRole}=await import('../src/guilds/role-policy.js');const base={id:verificationRole,guildId:verificationGuild,name:'Verified',position:1,managed:false,permissions:'0'};
 expect(()=>assertAssignableRole(verificationGuild,base,2,true)).not.toThrow();
 for(const permissions of ['8','268435456','1099511627776','17179869184','128'])expect(()=>assertAssignableRole(verificationGuild,{...base,permissions},2,true)).toThrow();
 for(const patch of [{managed:true},{id:verificationGuild},{guildId:'9223372036854775808'},{position:2}])expect(()=>assertAssignableRole(verificationGuild,{...base,...patch},2,true)).toThrow();expect(()=>assertAssignableRole(verificationGuild,base,2,false)).toThrow();
});

it('a definitive failure before panel send can be repaired and retried without getting stuck',async()=>{
 const f=fixture();let checks=0;f.port.validateSetup=async()=>{if(++checks===2)throw new Error('Permission was lost before send');};await expect(f.service.setup(verificationGuild,f.repository.settings.channelId!,verificationUser)).rejects.toThrow();expect(f.port.posts).toBe(0);
 f.port.validateSetup=async()=>{};await expect(f.service.setup(verificationGuild,f.repository.settings.channelId!,verificationUser)).resolves.toMatchObject({messageId:'1000000000000000001'});expect(f.port.posts).toBe(1);
});
it('verifysetup requires Manage Roles and explicit replacement acknowledgement',async()=>{
 const f=fixture(),{registerVerificationCommands}=await import('../src/features/verification/commands.js'),{createCommandRouter}=await import('../src/discord/interactions.js');const router=createCommandRouter([]);registerVerificationCommands(router,f.service,f.repository);let reply='';
 const input=(id:string,permissions:string,replace?:boolean)=>({id,name:'verifysetup',kind:'command' as const,guildId:verificationGuild,channelId:f.repository.settings.channelId,userId:verificationUser,member:{id:verificationUser,guildId:verificationGuild,displayName:'Owner',roleIds:[],permissions},options:replace===undefined?{}:{replace},async reply(text:string){reply=text;},async defer(){},async edit(text:string){reply=text;}});
 await router.dispatch(input('a','0'));expect(reply).toMatch(/Manage Roles/);await router.dispatch(input('b','268435456'));expect(reply).toMatch(/replace:true/);expect(f.port.posts).toBe(0);await router.dispatch(input('c','268435456',true));expect(f.port.posts).toBe(1);
});
