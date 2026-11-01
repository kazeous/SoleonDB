import {VerificationPanelError} from './ports.js';
import {ChannelType,Events,PermissionFlagsBits,ReactionType} from 'discord.js';
import type {Client,MessageReaction,PartialMessageReaction,User,PartialUser,Message,PartialMessage,MessageReactionEventDetails} from 'discord.js';
import {normalizeEmoji} from '@eousbot/contracts';
import {assertOutsideTransaction} from '../../db/client.js';
import {assertAssignableRole} from '../../guilds/role-policy.js';
import {AppError} from '../../core/errors.js';
import type {Logger} from '../../core/logger.js';
import type {VerificationPort,ReactionEvent} from './ports.js';
import type {VerificationBinding} from './repository.js';
import type {VerificationService} from './service.js';
function code(error:unknown):number|null{return error&&typeof error==='object'&&'code' in error?Number(error.code):null;}
export function createVerificationPort(client:Client,canOperate:(guildId:string)=>Promise<boolean>):VerificationPort {
 async function guard(guildId:string){assertOutsideTransaction();if(!client.isReady()||!await canOperate(guildId))throw new AppError('unavailable','Verification worker is not active');}
 async function channel(guildId:string,channelId:string){await guard(guildId);const guild=client.guilds.cache.get(guildId);const value=await guild?.channels.fetch(channelId);if(!value||value.guildId!==guildId||value.type!==ChannelType.GuildText&&value.type!==ChannelType.GuildAnnouncement)throw new AppError('validation','Choose a text channel in this server');return value;}
 async function panel(binding:VerificationBinding){if(!binding.messageId)throw new AppError('not_found','Panel is not registered');const destination=await channel(binding.guildId,binding.channelId),message=await destination.messages.fetch(binding.messageId);if(message.author.id!==client.user?.id||message.webhookId||message.guildId!==binding.guildId)throw new AppError('not_found','Registered panel author is invalid');return message;}
 async function role(guildId:string,roleId:string,nonPrivileged=true){
  await guard(guildId);const guild=client.guilds.cache.get(guildId);if(!guild)throw new AppError('unavailable','Server unavailable');await guild.roles.fetch();const value=await guild.roles.fetch(roleId),bot=await guild.members.fetchMe({force:true});if(!value)throw new AppError('not_found','Verified role was deleted');
  if(nonPrivileged)assertAssignableRole(guildId,{id:value.id,guildId,name:value.name,position:value.position,managed:value.managed,permissions:value.permissions.bitfield.toString()},bot.roles.highest.position,bot.permissions.has(PermissionFlagsBits.ManageRoles));
  else if(value.id===guildId||value.managed||!bot.permissions.has(PermissionFlagsBits.ManageRoles)||bot.roles.highest.comparePositionTo(value)<=0)throw new AppError('forbidden','Bot cannot remove the recorded verification role');return value;
 }
 return {
  async validateSetup(guildId,channelId,roleId,emojiRender,actorId){
   const destination=await channel(guildId,channelId),actor=await destination.guild.members.fetch({user:actorId,force:true});if(!actor.permissions.has(PermissionFlagsBits.ManageRoles))throw new AppError('forbidden','Manage Roles permission is required');await role(guildId,roleId);
   const bot=await destination.guild.members.fetchMe({force:true}),permissions=destination.permissionsFor(bot);if(!permissions?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AddReactions]))throw new AppError('forbidden','Bot needs View Channel, Send Messages, Read Message History and Add Reactions');
   const emoji=normalizeEmoji(emojiRender);if(emoji.id){const available=client.emojis.cache.get(emoji.id);if(!available?.available||available.guild.id!==guildId&&!permissions.has(PermissionFlagsBits.UseExternalEmojis))throw new AppError('validation','Choose a custom emoji accessible to this server and bot');}
  },
  async fetchPanel(binding){try{await panel(binding);return 'valid';}catch(error){if([10008,10003].includes(code(error)??0)||error instanceof AppError&&error.code==='not_found')return 'missing';throw error;}},
  async postPanel(binding,prompt){let dispatched=false;try{const destination=await channel(binding.guildId,binding.channelId);await guard(binding.guildId);dispatched=true;const message=await destination.send({embeds:[{title:'Server verification',description:prompt+'\nReact with '+binding.emojiRender+' to receive the verified role.',footer:{text:'verification:'+binding.operationId}}],nonce:binding.operationId.replaceAll('-','').slice(0,24),enforceNonce:true,allowedMentions:{parse:[]}});return message.id;}catch(error){const status=error&&typeof error==='object'&&'status' in error?Number(error.status):0;throw new VerificationPanelError(!dispatched||status>=400&&status<500?'not_sent':'unknown','Verification panel delivery could not be confirmed');}},
  async findPanel(binding){const destination=await channel(binding.guildId,binding.channelId),recent=await destination.messages.fetch({limit:100});return recent.find(message=>message.author.id===client.user?.id&&!message.webhookId&&message.embeds.some(embed=>embed.footer?.text==='verification:'+binding.operationId))?.id??null;},
  async ensurePanelReaction(binding){const message=await panel(binding);await guard(binding.guildId);await message.react(binding.emojiRender);},
  async listReactors(binding,type,cursor){
   const message=await panel(binding),reaction=message.reactions.cache.find(item=>item.emoji.id?binding.emojiKey==='custom:'+item.emoji.id:item.emoji.name!==null&&normalizeEmoji(item.emoji.name).key===binding.emojiKey);
   if(!reaction)return {userIds:[],nextCursor:null};
   const fetched=await reaction.users.fetch({type:type==='burst'?ReactionType.Burst:ReactionType.Normal,limit:100,...(cursor?{after:cursor}:{})}),userIds=[...fetched.keys()];
   const last=userIds.reduce<string|null>((max,id)=>max===null||BigInt(id)>BigInt(max)?id:max,null);return {userIds,nextCursor:userIds.length===100?last:null};
  },
  async memberRoleState(guildId,userId){await guard(guildId);const guild=client.guilds.cache.get(guildId);if(!guild)throw new AppError('unavailable','Server unavailable');try{const member=await guild.members.fetch({user:userId,force:true});return {roleIds:[...member.roles.cache.keys()],isBot:member.user.bot,present:true};}catch(error){if(code(error)===10007)return {roleIds:[],isBot:false,present:false};throw error;}},
  async addRole(guildId,userId,roleId){await role(guildId,roleId);const member=await client.guilds.cache.get(guildId)!.members.fetch({user:userId,force:true});if(member.user.bot)throw new AppError('forbidden','Bots cannot use member verification');await guard(guildId);await member.roles.add(roleId,'Reaction verification');},
  async removeRole(guildId,userId,roleId){try{await role(guildId,roleId,false);const member=await client.guilds.cache.get(guildId)!.members.fetch({user:userId,force:true});await guard(guildId);await member.roles.remove(roleId,'Verification reaction removed or role transferred');}catch(error){if([10007,10011].includes(code(error)??0)||error instanceof AppError&&error.code==='not_found')return;throw error;}},
 };
}
export function registerVerificationEvents(client:Client,service:VerificationService,canOperate:(guildId:string)=>Promise<boolean>,logger:Logger):()=>void {
 async function changed(reaction:MessageReaction|PartialMessageReaction,user:User|PartialUser,details:MessageReactionEventDetails,kind:'add'|'remove'){
  const guildId=reaction.message.guildId;if(!guildId||!await canOperate(guildId))return;
  const emojiKey=reaction.emoji.id?'custom:'+reaction.emoji.id:normalizeEmoji(reaction.emoji.name??'').key;
  await service.reactionChanged({guildId,channelId:reaction.message.channelId,messageId:reaction.message.id,userId:user.id,emojiKey,kind,reactionType:details.type===ReactionType.Burst?'burst':'normal'});
 }
 function report(work:Promise<unknown>){void work.catch(()=>logger.error('Verification event failed'));}
 const add=(reaction:MessageReaction|PartialMessageReaction,user:User|PartialUser,details:MessageReactionEventDetails)=>report(changed(reaction,user,details,'add'));
 const remove=(reaction:MessageReaction|PartialMessageReaction,user:User|PartialUser,details:MessageReactionEventDetails)=>report(changed(reaction,user,details,'remove'));
 const all=(message:Message|PartialMessage)=>{if(message.guildId)report(canOperate(message.guildId).then(allowed=>allowed?service.reactionChanged({kind:'remove_all',guildId:message.guildId!,channelId:message.channelId,messageId:message.id}):undefined));};
 const emoji=(reaction:MessageReaction|PartialMessageReaction)=>{const message=reaction.message;if(message.guildId)report(canOperate(message.guildId).then(allowed=>{if(!allowed)return;const event:ReactionEvent={kind:'remove_emoji',guildId:message.guildId!,channelId:message.channelId,messageId:message.id,emojiKey:reaction.emoji.id?'custom:'+reaction.emoji.id:normalizeEmoji(reaction.emoji.name??'').key};return service.reactionChanged(event);}));};
 client.on(Events.MessageReactionAdd,add);client.on(Events.MessageReactionRemove,remove);client.on(Events.MessageReactionRemoveAll,all);client.on(Events.MessageReactionRemoveEmoji,emoji);
 return ()=>{client.off(Events.MessageReactionAdd,add);client.off(Events.MessageReactionRemove,remove);client.off(Events.MessageReactionRemoveAll,all);client.off(Events.MessageReactionRemoveEmoji,emoji);};
}

