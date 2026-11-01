import {ChannelType,PermissionFlagsBits} from 'discord.js';
import type {Client} from 'discord.js';
import {assertOutsideTransaction} from '../../db/client.js';
import {AppError} from '../../core/errors.js';
import {ThreadPortError} from './service.js';
import type {AutoThreadPort} from './service.js';
export function createAutoThreadPort(client:Client,canOperate:(guildId:string)=>Promise<boolean>):AutoThreadPort{
 async function guard(guildId:string){assertOutsideTransaction();if(!client.isReady()||!await canOperate(guildId))throw new AppError('unavailable','Thread worker is not active');const guild=client.guilds.cache.get(guildId);if(!guild)throw new AppError('unavailable','Server unavailable');return guild;}
 async function source(guildId:string,channelId:string,messageId:string){const guild=await guard(guildId),channel=await guild.channels.fetch(channelId);if(!channel||channel.guildId!==guildId||channel.type!==ChannelType.GuildText&&channel.type!==ChannelType.GuildAnnouncement)throw new AppError('validation','Automatic threads require a text channel');const message=await channel.messages.fetch(messageId);if(message.author.bot||message.webhookId)throw new AppError('validation','Automatic threads only apply to human messages');return message;}
 function wrap(error:unknown,sent:boolean):ThreadPortError{const httpStatus=error&&typeof error==='object'&&'status'in error?Number(error.status):0;return new ThreadPortError(!sent||httpStatus>=400&&httpStatus<500?'rejected':'unknown','Thread operation failed');}
 return {
  async existingForMessage(guildId,channelId,messageId){try{const message=await source(guildId,channelId,messageId);if(!message.hasThread)return null;const thread=await message.guild!.channels.fetch(messageId);return thread?.isThread()&&thread.guildId===guildId?thread.id:null;}catch(error){throw wrap(error,false);}},
  async createForMessage(guildId,channelId,messageId,name,autoArchiveDuration=1440){let sent=false;try{const message=await source(guildId,channelId,messageId),bot=await message.guild!.members.fetchMe({force:true});if(!message.channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.CreatePublicThreads,PermissionFlagsBits.SendMessagesInThreads]))throw new AppError('forbidden','Missing thread permissions');await guard(guildId);sent=true;return (await message.startThread({name,autoArchiveDuration,reason:'Automatic discussion thread for eligible message'})).id;}catch(error){throw wrap(error,sent);}},
 };
}
