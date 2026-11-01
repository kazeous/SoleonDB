import {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,PermissionFlagsBits} from 'discord.js';
import type {Client} from 'discord.js';
import {assertOutsideTransaction} from '../../db/client.js';
import {AppError} from '../../core/errors.js';
import type {SuggestionPort} from './service.js';
import type {SuggestionView} from './repository.js';
const labels={voting:'Voting',approved:'Approved',rejected:'Rejected',in_progress:'In progress',implemented:'Implemented'};
export function buildSuggestionPayload(view:SuggestionView){return {embeds:[{title:('Suggestion: '+view.title).slice(0,256),description:view.description.slice(0,3500),fields:[{name:'Status',value:labels[view.status],inline:true},{name:'Suggested by',value:'<@'+view.authorId+'>',inline:true},...(view.statusReason?[{name:'Reason',value:view.statusReason.slice(0,1000)}]:[])],footer:{text:'suggestion:'+view.id}}],components:[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('suggestions:up').setLabel('Upvote ('+view.up+')').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('suggestions:down').setLabel('Downvote ('+view.down+')').setStyle(ButtonStyle.Danger))],allowedMentions:{parse:[] as never[]}};}
export function createSuggestionPort(client:Client,canOperate:(guildId:string)=>Promise<boolean>):SuggestionPort{
 async function guard(guildId:string){assertOutsideTransaction();if(!client.isReady()||!await canOperate(guildId))throw new AppError('unavailable','Suggestion worker is not active');const guild=client.guilds.cache.get(guildId);if(!guild)throw new AppError('unavailable','Server unavailable');return guild;}
 async function channel(guildId:string,channelId:string){const guild=await guard(guildId),value=await guild.channels.fetch(channelId);if(!value||value.guildId!==guildId||value.type!==ChannelType.GuildText&&value.type!==ChannelType.GuildAnnouncement)throw new AppError('validation','Suggestion destination must be a text channel in this server');return value;}
 async function member(guildId:string,userId:string){const guild=await guard(guildId),member=await guild.members.fetch({user:userId,force:true});if(member.user.bot)throw new AppError('forbidden','Bots cannot use member suggestions');return member;}
 async function panel(guildId:string,channelId:string,messageId:string){const destination=await channel(guildId,channelId),message=await destination.messages.fetch({message:messageId,force:true});if(message.guildId!==guildId||message.author.id!==client.user?.id||message.webhookId)throw new AppError('not_found','Registered suggestion author is invalid');return message;}
 return {
  async validateSubmit(guildId,channelId,userId){const destination=await channel(guildId,channelId),author=await member(guildId,userId),bot=await destination.guild.members.fetchMe({force:true});if(!destination.permissionsFor(author)?.has(PermissionFlagsBits.ViewChannel))throw new AppError('forbidden','You cannot view the suggestion board');if(!destination.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.EmbedLinks]))throw new AppError('forbidden','Bot cannot post suggestion cards in this channel');return {name:destination.name};},
  async assertMember(guildId,userId){await member(guildId,userId);},
  async canModerate(guildId,userId){return (await member(guildId,userId)).permissions.has(PermissionFlagsBits.ManageMessages);},
  async fetchPanel(guildId,channelId,messageId){try{await panel(guildId,channelId,messageId);return true;}catch(error){if(error instanceof AppError&&error.code==='not_found'||error&&typeof error==='object'&&'code'in error&&error.code===10008)return false;throw error;}},
  async post(guildId,channelId,id,view){const destination=await channel(guildId,channelId);await guard(guildId);return (await destination.send({...buildSuggestionPayload(view),nonce:id.replaceAll('-','').slice(0,24),enforceNonce:true})).id;},
  async findPost(guildId,channelId,id){const recent=await (await channel(guildId,channelId)).messages.fetch({limit:100});return recent.find(message=>message.author.id===client.user?.id&&!message.webhookId&&message.embeds.some(embed=>embed.footer?.text==='suggestion:'+id))?.id??null;},
  async update(guildId,channelId,messageId,view){const message=await panel(guildId,channelId,messageId);await guard(guildId);await message.edit(buildSuggestionPayload(view));},
  async existingThread(guildId,channelId,messageId){const message=await panel(guildId,channelId,messageId);if(message.hasThread){const thread=await message.guild?.channels.fetch(message.id);return thread?.isThread()?thread.id:null;}return null;},
  async createThread(guildId,channelId,messageId,title){const message=await panel(guildId,channelId,messageId);await guard(guildId);return (await message.startThread({name:('Discuss: '+title).slice(0,100),autoArchiveDuration:1440,reason:'Suggestion discussion'})).id;},
 };
}
