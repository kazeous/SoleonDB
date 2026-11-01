import {Events,ChannelType,PermissionFlagsBits} from 'discord.js';
import type {Client,GuildMember,PartialGuildMember} from 'discord.js';
import {assertOutsideTransaction} from '../../db/client.js';
import {AppError} from '../../core/errors.js';
import type {Logger} from '../../core/logger.js';
import {GreetingDeliveryError} from './service.js';
import type {GreetingPort,GreetingService} from './service.js';
export function createGreetingPort(client:Client,canOperate:(guildId:string)=>Promise<boolean>):GreetingPort{
 async function guard(guildId?:string){assertOutsideTransaction();if(!client.isReady()||guildId&&!await canOperate(guildId))throw new AppError('unavailable','Greeting worker is not active');}
 async function send(run:()=>Promise<{id:string}>){try{return (await run()).id;}catch(error){const status=error&&typeof error==='object'&&'status' in error?Number(error.status):0;throw new GreetingDeliveryError(status>=400&&status<500||error instanceof AppError?'rejected':'unknown','Greeting delivery failed');}}
 return {
  async context(guildId,userId){await guard(guildId);const guild=client.guilds.cache.get(guildId);if(!guild)throw new AppError('unavailable','Server unavailable');const user=await client.users.fetch(userId);return {guildName:guild.name,userName:user.globalName??user.username};},
  sendChannel:(guildId,channelId,text,allowedUserIds)=>send(async()=>{await guard(guildId);const channel=await client.guilds.cache.get(guildId)?.channels.fetch(channelId);if(!channel||channel.guildId!==guildId||channel.type!==ChannelType.GuildText&&channel.type!==ChannelType.GuildAnnouncement)throw new AppError('validation','Greeting channel is missing');const bot=await channel.guild.members.fetchMe({force:true});if(!channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]))throw new AppError('forbidden','Greeting channel permissions are missing');await guard(guildId);return channel.send({content:text,allowedMentions:{parse:[],users:allowedUserIds,repliedUser:false}});}),
  sendDm:(userId,text)=>send(async()=>{await guard();return (await client.users.fetch(userId)).send({content:text,allowedMentions:{parse:[]}});}),
 };
}
export function registerGreetingEvents(client:Client,service:GreetingService,canOperate:(guildId:string)=>Promise<boolean>,logger:Logger):()=>void{
 const report=(work:Promise<void>,guildId:string)=>{void work.catch(()=>logger.error({guildId},'Greeting event failed'));};
 async function changed(member:GuildMember|PartialGuildMember,join:boolean){if(!await canOperate(member.guild.id))return;const eventKey=member.joinedTimestamp?.toString();if(join)await service.memberJoined(member.guild.id,member.id,eventKey);else await service.memberLeft(member.guild.id,member.id,eventKey);}
 const join=(member:GuildMember)=>report(changed(member,true),member.guild.id),leave=(member:GuildMember|PartialGuildMember)=>report(changed(member,false),member.guild.id);client.on(Events.GuildMemberAdd,join);client.on(Events.GuildMemberRemove,leave);return ()=>{client.off(Events.GuildMemberAdd,join);client.off(Events.GuildMemberRemove,leave);};
}
