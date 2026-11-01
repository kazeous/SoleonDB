import {AuditLogEvent,PermissionFlagsBits} from 'discord.js';
import type {Client,Guild} from 'discord.js';
import type {ModerationPort} from '../features/moderation/ports.js';
import {ModerationEffectError,ModerationSendCancelled} from '../features/moderation/ports.js';
import {assertOutsideTransaction} from '../db/client.js';
function errorCode(error:unknown):number|null {return error&&typeof error==='object'&&'code' in error&&typeof error.code==='number'?error.code:null;}
function classify(error:unknown):ModerationEffectError|ModerationSendCancelled {
 if(error instanceof ModerationEffectError||error instanceof ModerationSendCancelled)return error;
 const status=error&&typeof error==='object'&&'status' in error?Number(error.status):0;
 return new ModerationEffectError(status>=400&&status<500?'rejected':'unknown',status>=400&&status<500?'Discord rejected the request':'Discord request outcome unknown');
}
export function createModerationPort(client:Client,canDispatch:()=>boolean):ModerationPort {
 function guard(){assertOutsideTransaction();if(!canDispatch())throw new ModerationEffectError('rejected','Worker is inactive');}
 function guild(guildId:string):Guild {assertOutsideTransaction();const result=client.guilds.cache.get(guildId);if(!client.isReady()||!result?.available)throw new ModerationEffectError('rejected','Server unavailable');return result;}
 return {
  async inspect(guildId,userId){
   const current=guild(guildId);await current.roles.fetch();const bot=await current.members.fetchMe({force:true});
   let target;try{target=await current.members.fetch({user:userId,force:true});}catch(error){if(errorCode(error)!==10007)throw classify(error);}
   const above=target?bot.roles.highest.comparePositionTo(target.roles.highest)>0:false;
   return {isOwner:current.ownerId===userId,isAdministrator:target?.permissions.has(PermissionFlagsBits.Administrator)??false,botCanTimeout:above&&bot.permissions.has(PermissionFlagsBits.ModerateMembers),botCanKick:above&&bot.permissions.has(PermissionFlagsBits.KickMembers),botCanBan:(above||!target)&&bot.permissions.has(PermissionFlagsBits.BanMembers),timeoutUntil:target?.communicationDisabledUntilTimestamp??null,roleIds:target?[...target.roles.cache.keys()]:[]};
  },
  async timeout(guildId,userId,until,reason,beforeSend){guard();try{const target=await guild(guildId).members.fetch({user:userId,force:true});if(beforeSend&&!await beforeSend())throw new ModerationSendCancelled();guard();await target.disableCommunicationUntil(until,reason);}catch(error){throw classify(error);}},
  async kick(guildId,userId,reason,beforeSend){guard();try{const current=guild(guildId);if(beforeSend&&!await beforeSend())throw new ModerationSendCancelled();guard();await current.members.kick(userId,reason);}catch(error){throw classify(error);}},
  async ban(guildId,userId,reason,beforeSend){guard();try{const current=guild(guildId);if(beforeSend&&!await beforeSend())throw new ModerationSendCancelled();guard();await current.members.ban(userId,{reason});}catch(error){throw classify(error);}},
  async deleteMessage(guildId,channelId,messageId,beforeSend){
   guard();try{const channel=await guild(guildId).channels.fetch(channelId);if(!channel||channel.guildId!==guildId||!channel.isTextBased())throw new ModerationEffectError('rejected','Message channel unavailable');if(beforeSend&&!await beforeSend())throw new ModerationSendCancelled();guard();await channel.messages.delete(messageId);return 'deleted';}
   catch(error){if(errorCode(error)===10008)return 'missing';throw classify(error);}
  },
  async lookupOutcome(intent){
   assertOutsideTransaction();
   try {
    const current=guild(intent.guildId),bot=await current.members.fetchMe({force:true});if(!bot.permissions.has(PermissionFlagsBits.ViewAuditLog)||!intent.action)return 'unknown';
    const type=intent.action.kind==='ban'?AuditLogEvent.MemberBanAdd:intent.action.kind==='kick'?AuditLogEvent.MemberKick:AuditLogEvent.MemberUpdate;
    const audit=await current.fetchAuditLogs({type,limit:100});
    const found=[...audit.entries.values()].some(entry=>entry.executorId===client.user?.id&&entry.targetId===intent.userId&&entry.createdTimestamp>=intent.createdAt&&entry.reason?.includes('[incident:'+intent.id+']'));
    return found?'applied':'unknown';
   }catch{return 'unknown';}
  },
 };
}
export function createModerationLogPort(client:Client,canDispatch:()=>boolean) {
 return {async send(guildId:string,channelId:string,text:string):Promise<void>{
  assertOutsideTransaction();if(!canDispatch())throw new ModerationEffectError('rejected','Worker is inactive');
  const guild=client.guilds.cache.get(guildId),channel=await guild?.channels.fetch(channelId);
  if(!channel||channel.guildId!==guildId||!channel.isTextBased()||!channel.isSendable())throw new ModerationEffectError('rejected','Moderation log channel unavailable');
  if(!canDispatch())throw new ModerationEffectError('rejected','Worker is inactive');
  await channel.send({content:text.slice(0,2000),allowedMentions:{parse:[]}});
 }};
}


