import {Client,Events,GatewayIntentBits,Partials,MessageFlags} from 'discord.js';
import type {Message,PartialMessage,Interaction,CommandInteractionOption} from 'discord.js';
import type {RuntimeEnv} from '../core/env.js';
import type {RuntimeStatus} from '../core/status.js';
import type {MessageSnapshot} from './messages.js';
import type {CommandContext} from './interactions.js';
import {unavailable} from '../core/errors.js';
export function extractExplicitMentions(content:string):MessageSnapshot['mentions'] {
  return {userIds:[...new Set([...content.matchAll(/<@!?([0-9]+)>/g)].map(m=>m[1]!))],roleIds:[...new Set([...content.matchAll(/<@&([0-9]+)>/g)].map(m=>m[1]!))],everyone:/@(everyone|here)\b/.test(content)};
}
export function createDiscordClient(env:RuntimeEnv,status:RuntimeStatus) {
  const intents=[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.GuildMessageReactions,GatewayIntentBits.GuildVoiceStates];
  if(env.enableMessageContent)intents.push(GatewayIntentBits.MessageContent);
  if(env.enablePresences)intents.push(GatewayIntentBits.GuildPresences);
  const client=new Client({intents,partials:[Partials.Message,Partials.Channel,Partials.Reaction,Partials.User,Partials.GuildMember],allowedMentions:{parse:[],repliedUser:false},rest:{timeout:15000,retries:0}});
  client.on(Events.ClientReady,()=>status.setDiscord(true));
  client.on(Events.ShardReady,()=>status.setDiscord(client.isReady()));
  client.on(Events.ShardResume,()=>status.setDiscord(client.isReady()));
  client.on(Events.ShardDisconnect,()=>status.setDiscord(false));
  client.on(Events.Invalidated,()=>status.setDiscord(false));
  client.on(Events.Error,()=>status.setDiscord(false));
  client.on(Events.ShardError,()=>status.setDiscord(false));
  return {client,async start(){if(!client.isReady())await client.login(env.discordToken);status.setDiscord(client.isReady());},async stop(){status.setDiscord(false);await client.destroy();}};
}
export async function snapshotMessage(input:Message|PartialMessage):Promise<MessageSnapshot|null> {
  if(!input.guildId)return null;
  try {
    const message=input.partial?await input.fetch():input;
    if(!message.guild||!message.author)throw unavailable();
    if(message.author.bot||message.webhookId)return null;
    const member=await message.guild.members.fetch({user:message.author.id,force:true});
    return {id:message.id,guildId:message.guild.id,channelId:message.channelId,userId:message.author.id,content:message.content,mentions:extractExplicitMentions(message.content),attachments:[...message.attachments.values()].map(a=>({id:a.id,contentType:a.contentType,name:a.name})),stickerIds:[...message.stickers.keys()],replyToMessageId:message.reference?.messageId??null,isThread:message.channel.isThread(),createdAt:message.createdTimestamp,editedAt:message.editedTimestamp,authorKind:'human',partial:false,member:{roleIds:[...member.roles.cache.keys()],permissions:member.permissions.bitfield.toString(),highestRolePosition:member.roles.highest.position,displayName:member.displayName}};
  }catch {throw unavailable('Message or member data unavailable; no clean result was inferred.');}
}
export async function interactionContext(interaction:Interaction):Promise<CommandContext|null> {
  if(!interaction.isRepliable())return null;
  const kind=interaction.isChatInputCommand()?'command':interaction.isContextMenuCommand()?'context':interaction.isMessageComponent()||interaction.isModalSubmit()?'component':null;
  if(!kind)return null;
  if(!interaction.deferred&&!interaction.replied)await interaction.deferReply({flags:MessageFlags.Ephemeral});
  let member:CommandContext['member']=null;
  if(interaction.guild && interaction.user) {
    const current=await interaction.guild.members.fetch({user:interaction.user.id,force:true});
    member={id:current.id,guildId:interaction.guild.id,displayName:current.displayName,roleIds:[...current.roles.cache.keys()],permissions:current.permissions.bitfield.toString()};
  }
  const options:Record<string,unknown>={};
  if(interaction.isChatInputCommand()) {
    function add(data:readonly CommandInteractionOption[]){for(const option of data){if(option.options)add(option.options);else options[option.name]=option.value;}}
    add(interaction.options.data);
  }
  if(interaction.isContextMenuCommand())options.targetId=interaction.targetId;
  if(interaction.isAnySelectMenu())options.values=interaction.values;
  if(interaction.isModalSubmit())for(const field of interaction.fields.fields.values())if('value' in field)options[field.customId]=field.value;
  return {id:interaction.id,name:'commandName' in interaction?interaction.commandName:interaction.customId,kind,guildId:interaction.guildId,channelId:interaction.channelId,userId:interaction.user.id,member,options,...('message' in interaction&&interaction.message?{messageId:interaction.message.id}:{}),
    async reply(text){if(interaction.deferred||interaction.replied)await interaction.editReply({content:text,allowedMentions:{parse:[]}});else await interaction.reply({content:text,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});},
    async defer(){if(!interaction.deferred&&!interaction.replied)await interaction.deferReply({flags:MessageFlags.Ephemeral});},
    async edit(text){await interaction.editReply({content:text,allowedMentions:{parse:[]}});},
  };
}

