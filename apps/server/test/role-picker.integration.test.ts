import {it,expect} from 'vitest';
import {withTestDb,seedGuild} from './database.js';
import type {AppDb} from '../src/db/client.js';
import {assertOutsideTransaction} from '../src/db/client.js';
import {fakeClock} from './clock.js';
import {FeatureStatusRegistry} from '../src/core/status.js';
import {createSettingsService} from '../src/guilds/settings.js';
import {createRolePickerService} from '../src/features/roles/service.js';
import type {RolesPort} from '../src/features/roles/ports.js';
import type {RoleRef} from '@eousbot/contracts';
const guild='9223372036854775807',channel='111111111111111111',roleId='222222222222222222',user='123456789012345678';
class Port implements RolesPort {
 roles:RoleRef[]=[{id:roleId,guildId:guild,name:'Member role',position:1,managed:false,permissions:'0'}];held=new Set<string>();effects:string[]=[];manageable=true;validPanel=true;actorAllowed=true;posts=0;accepted=new Map<string,string>();
 async validateCreate(){assertOutsideTransaction();if(!this.actorAllowed)throw new Error('Manage Roles required');return {name:'roles'};}
 async role(guildId:string,id:string){assertOutsideTransaction();return this.roles.find(r=>r.id===id)??null;}
 async botState(){assertOutsideTransaction();return {position:10,canManageRoles:this.manageable};}
 async memberRoleState(){assertOutsideTransaction();return {roleIds:[...this.held],isBot:false};}
 async postPanel(_guildId:string,_channelId:string,operationId:string){assertOutsideTransaction();this.posts++;const id=String(333333333333333300n+BigInt(this.posts));this.accepted.set(operationId,id);return id;}
 async findPanel(_guildId:string,_channelId:string,operationId:string){return this.accepted.get(operationId)??null;}
 async fetchPanel(){assertOutsideTransaction();return this.validPanel;}
 async addRole(_guildId:string,_userId:string,id:string){assertOutsideTransaction();this.held.add(id);this.effects.push('add:'+id);}
 async removeRole(_guildId:string,_userId:string,id:string){assertOutsideTransaction();this.held.delete(id);this.effects.push('remove:'+id);}
}
async function fixture(db:AppDb){await seedGuild(db,guild);await db.query('INSERT INTO guild_channels(guild_id,id,name,type) VALUES($1,$2,$3,$4)',[guild,channel,'roles','text']);const clock=fakeClock(1000),settings=createSettingsService(db,clock),port=new Port(),status=new FeatureStatusRegistry(clock);await settings.update(guild,'roles',{enabled:true,assignableRoleIds:[roleId]},0,user);const make=()=>createRolePickerService({db,clock,port,status});return {settings,port,service:make(),make};}
const input={title:'Choose your role',description:'Click to toggle.',roles:[{roleId,label:'Member'}]};
it('persists valid create/toggle bindings across service reconstruction',()=>withTestDb(async db=>{const f=await fixture(db),messageId=await f.service.create(guild,channel,user,input);expect(await f.make().toggle(guild,messageId,user,roleId)).toBe('added');expect(f.port.held.has(roleId)).toBe(true);expect(await f.make().toggle(guild,messageId,user,roleId)).toBe('removed');expect(f.port.held.has(roleId)).toBe(false);}));
it('serializes concurrent double-clicks and returns both correct outcomes',()=>withTestDb(async db=>{const f=await fixture(db),messageId=await f.service.create(guild,channel,user,input),responses=await Promise.all([f.service.toggle(guild,messageId,user,roleId),f.service.toggle(guild,messageId,user,roleId)]);expect(responses.sort()).toEqual(['added','removed']);expect(f.port.held.has(roleId)).toBe(false);expect(f.port.effects).toEqual(['add:'+roleId,'remove:'+roleId]);}));
it('replayed interaction keys never toggle twice after reconstruction',()=>withTestDb(async db=>{const f=await fixture(db),messageId=await f.service.create(guild,channel,user,input);expect(await f.service.toggle(guild,messageId,user,roleId,'click-1')).toBe('added');expect(await f.make().toggle(guild,messageId,user,roleId,'click-1')).toBe('added');expect(f.port.effects).toEqual(['add:'+roleId]);}));
it('rejects unknown panels, foreign guild bindings and roles not bound to the panel',()=>withTestDb(async db=>{const f=await fixture(db),messageId=await f.service.create(guild,channel,user,input);await expect(f.service.toggle(guild,'444444444444444444',user,roleId)).rejects.toThrow();await expect(f.service.toggle('9223372036854775808',messageId,user,roleId)).rejects.toThrow();await expect(f.service.toggle(guild,messageId,user,'555555555555555555')).rejects.toThrow();expect(f.port.effects).toEqual([]);}));
it.each([{managed:true},{id:guild},{permissions:'8'},{guildId:'9223372036854775808'},{position:10}])('rejects unsafe role at creation %o',patch=>withTestDb(async db=>{const f=await fixture(db);f.port.roles[0]={...f.port.roles[0]!,...patch};await expect(f.service.create(guild,channel,user,{...input,roles:[{roleId:f.port.roles[0]!.id,label:'Role'}]})).rejects.toThrow();expect(f.port.posts).toBe(0);}));
it('rejects deleted roles, lost hierarchy and forged message authors at click time',()=>withTestDb(async db=>{const f=await fixture(db),messageId=await f.service.create(guild,channel,user,input);f.port.roles=[];await expect(f.service.toggle(guild,messageId,user,roleId)).rejects.toThrow();f.port.roles=[{id:roleId,guildId:guild,name:'Role',position:1,managed:false,permissions:'0'}];f.port.manageable=false;await expect(f.service.toggle(guild,messageId,user,roleId)).rejects.toThrow();f.port.manageable=true;f.port.validPanel=false;await expect(f.service.toggle(guild,messageId,user,roleId)).rejects.toThrow();expect(f.port.effects).toEqual([]);}));
it('requires Manage Roles and at most five configured button options',()=>withTestDb(async db=>{const f=await fixture(db);f.port.actorAllowed=false;await expect(f.service.create(guild,channel,user,input)).rejects.toThrow();f.port.actorAllowed=true;await expect(f.service.create(guild,channel,user,{...input,roles:Array.from({length:6},()=>input.roles[0]!)})).rejects.toThrow();expect(f.port.posts).toBe(0);}));
it('verification and self-service role configurations cannot overlap',()=>withTestDb(async db=>{const f=await fixture(db);await expect(f.settings.update(guild,'verification',{enabled:true,channelId:channel,roleId,emoji:'✅',prompt:'Verify'},0,user)).rejects.toMatchObject({code:'validation'});expect(f.port.effects).toEqual([]);}));
