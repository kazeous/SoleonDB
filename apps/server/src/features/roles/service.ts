import {randomUUID} from 'node:crypto';
import {rolePickerInputSchema,rolesConfigSchema,snowflakeSchema} from '@eousbot/contracts';
import type {RolePickerInput} from '@eousbot/contracts';
import type {AppDb} from '../../db/client.js';
import {withTransaction} from '../../db/client.js';
import {withConfigLock,withMemberLock} from '../../db/locks.js';
import type {Clock} from '../../core/clock.js';
import type {FeatureStatusRegistry} from '../../core/status.js';
import {AppError} from '../../core/errors.js';
import {createSettingsService} from '../../guilds/settings.js';
import {assertAssignableRole} from '../../guilds/role-policy.js';
import {createRolePickerRepository,assertVerificationRoleAvailable} from './repository.js';
import type {RolesPort} from './ports.js';
import {RoleEffectError} from './ports.js';
export function createRolePickerService(deps:{db:AppDb;clock:Clock;port:RolesPort;status:FeatureStatusRegistry}) {
 const {db,clock,port,status}=deps,settings=createSettingsService(db,clock),repository=createRolePickerRepository(db),queues=new Map<string,Promise<unknown>>();
 function serialized<T>(guildId:string,userId:string,run:()=>Promise<T>):Promise<T>{const key=guildId+':'+userId,pending=(queues.get(key)??Promise.resolve()).catch(()=>undefined).then(run).finally(()=>{if(queues.get(key)===pending)queues.delete(key);});queues.set(key,pending);return pending;}
 async function eligible(guildId:string,roleId:string){const [role,bot]=await Promise.all([port.role(guildId,roleId),port.botState(guildId)]);if(!role)throw new AppError('not_found','The selected role was deleted. Ask a moderator to repair the panel.');assertAssignableRole(guildId,role,bot.position,bot.canManageRoles);}
 async function allowed(guildId:string,roleIds:string[]){const config=await settings.read(guildId,'roles');if(!config.value.enabled||roleIds.some(id=>!config.value.assignableRoleIds.includes(id)))throw new AppError('forbidden','This role is not enabled for self-service in this server');for(const roleId of roleIds)try{await assertVerificationRoleAvailable(db,guildId,roleId);}catch{throw new AppError('validation','Verification roles cannot also be used in role pickers');}return config;}
 return {
  async create(guildId:string,channelId:string,actorId:string,raw:RolePickerInput,operationKey:string=randomUUID()):Promise<string>{
   const input=rolePickerInputSchema.parse(raw);snowflakeSchema.parse(guildId);snowflakeSchema.parse(channelId);snowflakeSchema.parse(actorId);
   const channel=await port.validateCreate(guildId,channelId,actorId);await allowed(guildId,input.roles.map(option=>option.roleId));for(const option of input.roles)await eligible(guildId,option.roleId);
   let existing=await repository.byOperation(guildId,operationKey),fresh=false;
   if(!existing){
    const id=randomUUID();fresh=await withTransaction(db,tx=>withConfigLock(tx,guildId,async()=>{
     const active=await tx.query('SELECT 1 FROM guilds WHERE id=$1 AND active AND bot_present',[guildId]);if(!active.rowCount)throw new AppError('forbidden','Activate this server first');
     if((await tx.query('SELECT 1 FROM role_picker_panels WHERE guild_id=$1 AND operation_key=$2',[guildId,operationKey])).rowCount)return false;
     const current=(await tx.query<{value:unknown}>('SELECT value FROM feature_settings WHERE guild_id=$1 AND feature=$2',[guildId,'roles'])).rows[0];const config=rolesConfigSchema.parse(current?.value);if(!config.enabled||input.roles.some(option=>!config.assignableRoleIds.includes(option.roleId)))throw new AppError('conflict','Role settings changed before panel creation');
     for(const option of input.roles)await assertVerificationRoleAvailable(tx,guildId,option.roleId);
     await tx.query('INSERT INTO guild_channels(guild_id,id,name,type) VALUES($1,$2,$3,$4) ON CONFLICT(guild_id,id) DO UPDATE SET name=$3,type=$4',[guildId,channelId,channel.name,'text']);
     await tx.query('INSERT INTO role_picker_panels(guild_id,id,channel_id,operation_key,title,description,state,created_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[guildId,id,channelId,operationKey,input.title,input.description,'creating',actorId,clock.now()]);
     for(const [position,option] of input.roles.entries())await tx.query('INSERT INTO role_picker_options(guild_id,panel_id,role_id,label,emoji,position) VALUES($1,$2,$3,$4,$5,$6)',[guildId,id,option.roleId,option.label,option.emoji??null,position]);return true;
    }));existing=await repository.byOperation(guildId,operationKey);
   }
   if(!existing)throw new AppError('unavailable','Panel reservation unavailable');if(existing.state==='ready'&&existing.messageId)return existing.messageId;
   try{
    const messageId=fresh?await port.postPanel(guildId,existing.channelId,existing.id,existing.input):await port.findPanel(guildId,existing.channelId,existing.id);
    if(!messageId)throw new AppError('unavailable','Panel delivery is unconfirmed. No duplicate panel was posted.');snowflakeSchema.parse(messageId);
    await db.query('UPDATE role_picker_panels SET message_id=$3,state=$4 WHERE guild_id=$1 AND id=$2',[guildId,existing.id,messageId,'ready']);status.set(guildId,'roles','ready');return messageId;
   }catch(error){await db.query('UPDATE role_picker_panels SET state=$3 WHERE guild_id=$1 AND id=$2',[guildId,existing.id,'unknown']);status.set(guildId,'roles','degraded','Panel creation requires reconciliation; no automatic duplicate send.');throw error;}
  },
  async toggle(guildId:string,messageId:string,userId:string,roleId:string,operationKey:string=randomUUID()):Promise<'added'|'removed'>{
   return serialized(guildId,userId,async()=>{
    const panel=await repository.byMessage(guildId,messageId);if(!panel||!panel.input.roles.some(option=>option.roleId===roleId))throw new AppError('not_found','This message and role are not a registered picker');
    await allowed(guildId,[roleId]);if(!await port.fetchPanel(guildId,panel.channelId,messageId))throw new AppError('not_found','Registered panel is missing or its author is invalid');
    const prior=await repository.operation(guildId,operationKey);if(prior?.state==='complete')return prior.desired?'added':'removed';
    await eligible(guildId,roleId);const member=await port.memberRoleState(guildId,userId);if(member.isBot)throw new AppError('forbidden','Member role pickers cannot be used by bots');
    for(const pending of await repository.unfinished(guildId,userId,roleId)){
     if(member.roleIds.includes(roleId)!==pending.desired)throw new AppError('unavailable','A previous role update is unconfirmed. Wait for reconciliation before toggling again.');
     await db.query('UPDATE role_picker_operations SET state=$3,completed_at=$4 WHERE guild_id=$1 AND id=$2',[guildId,pending.id,'complete',clock.now()]);if(pending.id===operationKey)return pending.desired?'added':'removed';
    }
    const desired=!member.roleIds.includes(roleId);
    await withTransaction(db,tx=>withMemberLock(tx,guildId,userId,async()=>{
     const current=(await tx.query<{value:unknown}>('SELECT value FROM feature_settings WHERE guild_id=$1 AND feature=$2',[guildId,'roles'])).rows[0];const config=rolesConfigSchema.parse(current?.value);if(!config.enabled||!config.assignableRoleIds.includes(roleId))throw new AppError('conflict','Role configuration changed');await assertVerificationRoleAvailable(tx,guildId,roleId);
     await tx.query('INSERT INTO role_picker_operations(guild_id,id,panel_id,role_id,user_id,desired,state,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[guildId,operationKey,panel.id,roleId,userId,desired,'dispatching',clock.now()]);
    }));
    try{if(desired)await port.addRole(guildId,userId,roleId);else await port.removeRole(guildId,userId,roleId);await db.query('UPDATE role_picker_operations SET state=$3,completed_at=$4 WHERE guild_id=$1 AND id=$2',[guildId,operationKey,'complete',clock.now()]);status.set(guildId,'roles','ready');return desired?'added':'removed';}
    catch(error){const state=error instanceof RoleEffectError&&error.outcome==='rejected'?'failed':'unknown';await db.query('UPDATE role_picker_operations SET state=$3 WHERE guild_id=$1 AND id=$2',[guildId,operationKey,state]);status.set(guildId,'roles','degraded','A member role update failed or needs reconciliation.');throw new AppError('unavailable',state==='failed'?'Discord rejected the role change. Check role permissions.':'Role update outcome is unconfirmed; it will not be blindly toggled again.');}
   });
  },
 };
}
export type RolePickerService=ReturnType<typeof createRolePickerService>;

