import {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,PermissionFlagsBits} from 'discord.js';
import type {Client} from 'discord.js';
import {normalizeEmoji} from '@eousbot/contracts';
import type {RolePickerInput} from '@eousbot/contracts';
import {assertOutsideTransaction} from '../../db/client.js';
import {AppError} from '../../core/errors.js';
import {assertAssignableRole} from '../../guilds/role-policy.js';
import {RoleEffectError} from './ports.js';
import type {RolesPort} from './ports.js';
export function buildRolePickerPayload(operationId:string,input:RolePickerInput){
 const row=new ActionRowBuilder<ButtonBuilder>().addComponents(input.roles.map(option=>{const button=new ButtonBuilder().setCustomId('roles:'+option.roleId).setLabel(option.label).setStyle(ButtonStyle.Secondary);if(option.emoji){const emoji=normalizeEmoji(option.emoji);button.setEmoji(emoji.id?{id:emoji.id}:emoji.render);}return button;}));
 return {embeds:[{title:input.title,description:input.description||'Select a role to add or remove it.',footer:{text:'role-picker:'+operationId}}],components:[row],allowedMentions:{parse:[] as never[]},nonce:operationId.replaceAll('-','').slice(0,24),enforceNonce:true};
}
export function createRolesPort(client:Client,canOperate:(guildId:string)=>Promise<boolean>):RolesPort {
 async function guard(guildId:string){assertOutsideTransaction();if(!client.isReady()||!await canOperate(guildId))throw new AppError('unavailable','Role worker is not active');const guild=client.guilds.cache.get(guildId);if(!guild)throw new AppError('unavailable','Server unavailable');return guild;}
 async function channel(guildId:string,channelId:string){const guild=await guard(guildId),value=await guild.channels.fetch(channelId);if(!value||value.guildId!==guildId||value.type!==ChannelType.GuildText&&value.type!==ChannelType.GuildAnnouncement)throw new AppError('validation','Choose a text channel in this server');return value;}
 async function role(guildId:string,roleId:string){const guild=await guard(guildId);await guild.roles.fetch();const role=await guild.roles.fetch(roleId);return role?{id:role.id,guildId:role.guild.id,name:role.name,position:role.position,managed:role.managed,permissions:role.permissions.bitfield.toString()}:null;}
 async function botState(guildId:string){const guild=await guard(guildId),bot=await guild.members.fetchMe({force:true});return {position:bot.roles.highest.position,canManageRoles:bot.permissions.has(PermissionFlagsBits.ManageRoles)};}
 async function change(guildId:string,userId:string,roleId:string,add:boolean){let sent=false;try{const value=await role(guildId,roleId),bot=await botState(guildId);if(!value)throw new AppError('not_found','Selected role was deleted');assertAssignableRole(guildId,value,bot.position,bot.canManageRoles);const guild=await guard(guildId),member=await guild.members.fetch({user:userId,force:true});if(member.user.bot)throw new AppError('forbidden','Bots cannot use member role pickers');await guard(guildId);sent=true;if(add)await member.roles.add(roleId,'Self-service role picker');else await member.roles.remove(roleId,'Self-service role picker');}catch(error){const status=error&&typeof error==='object'&&'status' in error?Number(error.status):0;throw new RoleEffectError(!sent||status>=400&&status<500?'rejected':'unknown','Discord role update failed');}}
 return {
  role,botState,
  async validateCreate(guildId,channelId,actorId){const destination=await channel(guildId,channelId),actor=await destination.guild.members.fetch({user:actorId,force:true}),bot=await destination.guild.members.fetchMe({force:true});if(!actor.permissions.has(PermissionFlagsBits.ManageRoles))throw new AppError('forbidden','Manage Roles is required');if(!destination.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks,PermissionFlagsBits.ReadMessageHistory]))throw new AppError('forbidden','Bot needs View Channel, Send Messages, Embed Links and Read Message History');return {name:destination.name};},
  async memberRoleState(guildId,userId){const guild=await guard(guildId),member=await guild.members.fetch({user:userId,force:true});return {roleIds:[...member.roles.cache.keys()],isBot:member.user.bot};},
  async postPanel(guildId,channelId,operationId,input){const destination=await channel(guildId,channelId);await guard(guildId);return (await destination.send(buildRolePickerPayload(operationId,input))).id;},
  async findPanel(guildId,channelId,operationId){const recent=await (await channel(guildId,channelId)).messages.fetch({limit:100});return recent.find(message=>message.author.id===client.user?.id&&!message.webhookId&&message.embeds.some(embed=>embed.footer?.text==='role-picker:'+operationId))?.id??null;},
  async fetchPanel(guildId,channelId,messageId){try{const message=await (await channel(guildId,channelId)).messages.fetch(messageId);return message.guildId===guildId&&message.author.id===client.user?.id&&!message.webhookId;}catch(error){const code=error&&typeof error==='object'&&'code' in error?Number(error.code):0;if(code===10008||code===10003)return false;throw error;}},
  addRole:(guildId,userId,roleId)=>change(guildId,userId,roleId,true),removeRole:(guildId,userId,roleId)=>change(guildId,userId,roleId,false),
 };
}
