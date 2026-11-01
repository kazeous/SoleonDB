import {ChannelType,PermissionFlagsBits} from 'discord.js';
import type {Client,Guild} from 'discord.js';
import type {GuildDirectory} from '../guilds/ports.js';
import type {ChannelRef} from '@eousbot/contracts';
import {unavailable} from '../core/errors.js';
export function createGuildDirectory(client:Client):GuildDirectory {
  async function guild(id:string):Promise<Guild> {
    if(!client.isReady())throw unavailable('Discord is disconnected');
    try {const result=await client.guilds.fetch({guild:id,force:true});if(!result.available)throw unavailable();return result;}
    catch {throw unavailable('Server data unavailable. Please retry.');}
  }
  async function access(ownerId:string,guildId:string):Promise<'owner'|'manage_guild'|'none'> {
    if(!client.isReady())throw unavailable('Discord is disconnected');
    if(!client.guilds.cache.has(guildId))return 'none';
    const current=await guild(guildId);if(current.ownerId===ownerId)return 'owner';
    try {
      await current.roles.fetch();
      const member=await current.members.fetch({user:ownerId,force:true});
      return member.permissions.has(PermissionFlagsBits.ManageGuild)?'manage_guild':'none';
    } catch(error) {if(error&&typeof error==='object'&&'code' in error&&error.code===10007)return 'none';throw unavailable('Current server permissions unavailable');}
  }
  return {
    access,
    async list(ownerId){
      if(!client.isReady())throw unavailable('Discord is disconnected');
      return Promise.all([...client.guilds.cache.values()].map(async item=>({id:item.id,name:item.name,iconUrl:item.iconURL(),active:false,eligible:await access(ownerId,item.id)!=='none'})));
    },
    async channels(guildId){
      try {
        const channels=await (await guild(guildId)).channels.fetch();const result:ChannelRef[]=[];
        for(const channel of channels.values()) {
          if(!channel)continue;
          const type=channel.type===ChannelType.GuildVoice?'voice':channel.type===ChannelType.GuildCategory?'category':channel.isThread()?'thread':channel.type===ChannelType.GuildText||channel.type===ChannelType.GuildAnnouncement?'text':null;
          if(type)result.push({id:channel.id,guildId,name:channel.name,type});
        }
        return result;
      }catch {throw unavailable('Channel data unavailable');}
    },
    async roles(guildId){try {const roles=await(await guild(guildId)).roles.fetch();return [...roles.values()].map(role=>({id:role.id,guildId,name:role.name,position:role.position,managed:role.managed,permissions:role.permissions.bitfield.toString()}));}catch {throw unavailable('Role data unavailable');}},
    async members(guildId,query,limit){try {const current=await guild(guildId);const members=/^[1-9][0-9]{0,19}$/.test(query)?[await current.members.fetch({user:query,force:true})]:[...(await current.members.search({query,limit:Math.min(25,Math.max(1,limit))})).values()];return members.map(member=>({id:member.id,guildId,displayName:member.displayName,roleIds:[...member.roles.cache.keys()],permissions:member.permissions.bitfield.toString()}));}catch(error) {if(error&&typeof error==='object'&&'code' in error&&error.code===10007)return [];throw unavailable('Member search unavailable');}},
  };
}

