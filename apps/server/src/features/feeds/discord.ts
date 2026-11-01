import {ChannelType,PermissionFlagsBits} from 'discord.js';
import type {Client} from 'discord.js';
import {feedItemSchema} from '@eousbot/contracts';
import type {FeedItem} from '@eousbot/contracts';
import {assertOutsideTransaction} from '../../db/client.js';
import {AppError} from '../../core/errors.js';
import {FeedSendCancelled} from './types.js';
import type {FeedPort} from './types.js';
import {FeedSendError} from './delivery.js';
function missing(error:unknown){return error&&typeof error==='object'&&'code'in error&&(error.code===10003||error.code===10008);}
export function buildFeedPayload(raw:FeedItem){const item=feedItemSchema.parse(raw);return {embeds:[{title:item.title,url:item.url,...(item.description?{description:item.description}:{}),...(item.imageUrl?{image:{url:item.imageUrl}}:{}),...(item.publishedAt>0?{timestamp:new Date(item.publishedAt).toISOString()}:{}),footer:{text:'Feed update'}}],allowedMentions:{parse:[] as never[]}};}
export function createFeedPort(client:Client,canOperate:(guildId:string)=>Promise<boolean>):FeedPort{
 async function guard(guildId:string){assertOutsideTransaction();if(!client.isReady()||!await canOperate(guildId))throw new AppError('unavailable','Feed worker is not active');const guild=client.guilds.cache.get(guildId);if(!guild)throw new AppError('unavailable','Server unavailable');return guild;}
 async function destination(guildId:string,channelId:string){const guild=await guard(guildId),value=await guild.channels.fetch(channelId);if(!value||value.guildId!==guildId||value.type!==ChannelType.GuildText&&value.type!==ChannelType.GuildAnnouncement)throw new AppError('not_found','Feed destination is missing');return value;}
 return {
  async destination(guildId,channelId){try{const channel=await destination(guildId,channelId),bot=await channel.guild.members.fetchMe({force:true});return channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks,PermissionFlagsBits.ReadMessageHistory])??false;}catch(error){if(missing(error)||error instanceof AppError&&error.code==='not_found')return false;throw error;}},
  async send(guildId,channelId,operationId,item,authorize){let dispatched=false;try{const channel=await destination(guildId,channelId),payload=buildFeedPayload(item),bot=await channel.guild.members.fetchMe({force:true});if(!channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks]))throw new AppError('forbidden','Feed destination permissions are missing');await guard(guildId);if(!await authorize())throw new FeedSendCancelled();dispatched=true;return (await channel.send({...payload,nonce:operationId.replaceAll('-','').slice(0,24),enforceNonce:true})).id;}catch(error){if(error instanceof FeedSendCancelled)throw error;const status=error&&typeof error==='object'&&'status'in error?Number(error.status):0;throw new FeedSendError(!dispatched||status>=400&&status<500?'rejected':'unknown','Feed message delivery could not be confirmed');}},
  async findAccepted(guildId,channelId,operationId,messageId){const channel=await destination(guildId,channelId),nonce=operationId.replaceAll('-','').slice(0,24);if(messageId)try{const message=await channel.messages.fetch({message:messageId,force:true});return message.guildId===guildId&&message.channelId===channelId&&message.author.id===client.user?.id&&!message.webhookId?message.id:null;}catch(error){if(!missing(error))throw error;}const recent=await channel.messages.fetch({limit:100});return recent.find(message=>message.author.id===client.user?.id&&!message.webhookId&&String(message.nonce)===nonce)?.id??null;},
 };
}
