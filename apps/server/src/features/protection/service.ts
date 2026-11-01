import {randomUUID} from 'node:crypto';
import {ruleInputSchema} from '@eousbot/contracts';
import type {RuleInput,ChannelRule} from '@eousbot/contracts';
import type {AppDb,AppTx} from '../../db/client.js';
import {withTransaction} from '../../db/client.js';
import {withConfigLock} from '../../db/locks.js';
import type {Clock} from '../../core/clock.js';
import {AppError} from '../../core/errors.js';
import type {GuildDirectory} from '../../guilds/ports.js';
import {createRuleRepository} from './repository.js';
export function createRuleService(db:AppDb,clock:Clock,directory:GuildDirectory) {
 const repository=createRuleRepository(db);
 async function validateEntities(guildId:string,input:RuleInput):Promise<RuleInput> {
  const value=ruleInputSchema.parse(input);
  const channels=await directory.channels(guildId);
  const channel=channels.find(c=>c.guildId===guildId&&c.id===value.channelId&&c.type==='text');
  if(!channel)throw new AppError('validation','Select a text channel in this server',{channelId:'Invalid channel'});
  if(value.exemptRoleIds.length){const roles=await directory.roles(guildId);if(value.exemptRoleIds.some(id=>!roles.some(r=>r.guildId===guildId&&r.id===id)))throw new AppError('validation','Select exemption roles in this server',{exemptRoleIds:'Invalid role'});}
  for(const id of value.exemptUserIds){const members=await directory.members(guildId,id,1);if(!members.some(member=>member.guildId===guildId&&member.id===id))throw new AppError('validation','Select exemption members in this server',{exemptUserIds:'Invalid member'});}
  await db.query('INSERT INTO guild_channels(guild_id,id,name,type) VALUES($1,$2,$3,$4) ON CONFLICT(guild_id,id) DO UPDATE SET name=$3,type=$4',[guildId,channel.id,channel.name,channel.type]);
  return value;
 }
 async function audit(tx:AppTx,guildId:string,ownerId:string,previous:unknown,value:unknown){await tx.query('INSERT INTO configuration_audit(guild_id,actor_id,feature,previous_value,new_value,created_at) VALUES($1,$2,$3,$4,$5,$6)',[guildId,ownerId,'channel_rules',previous,value,clock.now()]);}
 async function existing(tx:AppTx,guildId:string,id:string,revision:number){
  const current=await repository.current(tx,guildId,id);if(!current)throw new AppError('not_found','Rule not found in this server');
  if(current.revision!==revision)throw new AppError('conflict','Rule changed. Reload before saving.');return current;
 }
 return {
  list:repository.list,
  async create(guildId:string,input:RuleInput,ownerId:string):Promise<ChannelRule>{
   const value=await validateEntities(guildId,input);
   return withTransaction(db,tx=>withConfigLock(tx,guildId,async()=>{
    const rule={...value,id:randomUUID(),guildId,revision:1};
    await tx.query('INSERT INTO channel_rules(guild_id,id,channel_id,enabled,config) VALUES($1,$2,$3,$4,$5)',[guildId,rule.id,rule.channelId,rule.enabled,value]);await audit(tx,guildId,ownerId,null,rule);return rule;
   }));
  },
  async update(guildId:string,id:string,input:RuleInput,expectedRevision:number,ownerId:string):Promise<ChannelRule>{
   const value=await validateEntities(guildId,input);
   return withTransaction(db,tx=>withConfigLock(tx,guildId,async()=>{
    const previous=await existing(tx,guildId,id,expectedRevision);const rule={...value,id,guildId,revision:previous.revision+1};
    await tx.query('UPDATE channel_rules SET channel_id=$3,enabled=$4,config=$5,revision=$6 WHERE guild_id=$1 AND id=$2',[guildId,id,value.channelId,value.enabled,value,rule.revision]);await audit(tx,guildId,ownerId,previous,rule);return rule;
   }));
  },
  async remove(guildId:string,id:string,expectedRevision:number,ownerId:string):Promise<void>{
   await withTransaction(db,tx=>withConfigLock(tx,guildId,async()=>{
    const previous=await existing(tx,guildId,id,expectedRevision);
    await tx.query('UPDATE channel_rules SET enabled=false,revision=revision+1,deleted_at=$3 WHERE guild_id=$1 AND id=$2',[guildId,id,clock.now()]);await audit(tx,guildId,ownerId,previous,{id,deleted:true,revision:previous.revision+1});
   }));
  },
 };
}
export type RuleService=ReturnType<typeof createRuleService>;

