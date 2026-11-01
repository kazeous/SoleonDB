import type {Client,TextChannel,NewsChannel,Webhook} from 'discord.js';
import {PermissionFlagsBits} from 'discord.js';
export function createSocialWebhooks(client:Client){
 const preparing=new Map<string,Promise<Webhook>>();
 async function prepare(channel:TextChannel|NewsChannel){const bot=await channel.guild.members.fetchMe({force:true});if(!channel.permissionsFor(bot)?.has(PermissionFlagsBits.ManageWebhooks))return null;const key=channel.guildId+':'+channel.id,existing=preparing.get(key);if(existing)return existing;const pending=(async()=>{const hooks=await channel.fetchWebhooks(),owned=hooks.find(hook=>hook.owner?.id===client.user?.id&&hook.name==='Eousbot Embed Reposter');return owned??await channel.createWebhook({name:'Eousbot Embed Reposter',reason:'Repost media links with the original author attribution'});})().finally(()=>{if(preparing.get(key)===pending)preparing.delete(key);});preparing.set(key,pending);return pending;}
 return {prepare};
}
