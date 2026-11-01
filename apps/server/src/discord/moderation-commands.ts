import type {Client} from 'discord.js';
import {GatewayIntentBits} from 'discord.js';
import type {CommandAuthority} from '../features/moderation/commands.js';
import type {CleanMessage} from '../features/moderation/clean.js';
import {assertOutsideTransaction} from '../db/client.js';
import {AppError} from '../core/errors.js';
export function createCommandAuthority(client:Client):CommandAuthority {
 return {async inspect(guildId,actorId,targetId){
  assertOutsideTransaction();const guild=client.guilds.cache.get(guildId);if(!client.isReady()||!guild?.available)throw new AppError('unavailable','Server is unavailable');
  try {
   await guild.roles.fetch();const [actor,bot]=await Promise.all([guild.members.fetch({user:actorId,force:true}),guild.members.fetchMe({force:true})]);
   let target=null;if(targetId){try{target=await guild.members.fetch({user:targetId,force:true});}catch(error){if(!error||typeof error!=='object'||!('code' in error)||error.code!==10007)throw error;}}
   return {guildId,actorId,targetId,ownerId:guild.ownerId,botId:bot.id,actorPermissions:actor.permissions.bitfield.toString(),actorPosition:actor.roles.highest.position,botPosition:bot.roles.highest.position,targetPosition:target?.roles.highest.position??null};
  }catch {throw new AppError('unavailable','Current member permissions are unavailable. Please retry.');}
 }};
}
export function createCleanMessagePort(client:Client) {
 return {async list(guildId:string,channelId:string,limit:number):Promise<CleanMessage[]>{
  assertOutsideTransaction();if(!client.options.intents.has(GatewayIntentBits.MessageContent))throw new AppError('unavailable','Enable the Message Content intent for cleanup filters');
  const guild=client.guilds.cache.get(guildId),channel=await guild?.channels.fetch(channelId);if(!channel||channel.guildId!==guildId||!channel.isTextBased())throw new AppError('unavailable','Message channel is unavailable');
  const messages=await channel.messages.fetch({limit:Math.min(100,Math.max(1,limit))});
  return [...messages.values()].map(message=>({id:message.id,guildId,channelId,authorId:message.author.id,bot:message.author.bot,content:message.content,createdAt:message.createdTimestamp,attachmentCount:message.attachments.size,embedCount:message.embeds.length}));
 }};
}

