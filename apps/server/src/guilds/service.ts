import type {AppDb} from '../db/client.js';
import type {GuildDirectory} from './ports.js';
import type {GuildSummary} from '@eousbot/contracts';
import {AppError} from '../core/errors.js';
export function createGuildService(db:AppDb,directory:GuildDirectory) {
  async function assertReadable(guildId:string):Promise<void> {
    const known=await db.query('SELECT 1 FROM guilds WHERE id=$1',[guildId]);
    if(!known.rowCount) throw new AppError('not_found','Server not found');
  }
  async function assertEligible(ownerId:string,guildId:string):Promise<void> {
    if(await directory.access(ownerId,guildId)==='none') throw new AppError('forbidden','Manage Server permission and bot membership are required');
  }
  async function syncChannels(guildId:string) {
    const channels=await directory.channels(guildId);
    for(const channel of channels) {
      if(channel.guildId!==guildId) throw new AppError('unavailable','Discord returned inconsistent channel data');
      await db.query('INSERT INTO guild_channels(guild_id,id,name,type) VALUES($1,$2,$3,$4) ON CONFLICT(guild_id,id) DO UPDATE SET name=$3,type=$4',[guildId,channel.id,channel.name,channel.type]);
    }
    return channels;
  }
  return {
    assertReadable,assertEligible,syncChannels,
    async assertGuildWrite(ownerId:string,guildId:string):Promise<void> {
      await assertEligible(ownerId,guildId);
      const result=await db.query<{active:boolean;bot_present:boolean}>('SELECT active,bot_present FROM guilds WHERE id=$1',[guildId]);
      if(!result.rows[0]?.active||!result.rows[0].bot_present) throw new AppError('forbidden','Activate this server before editing settings');
    },
    async list(ownerId:string):Promise<GuildSummary[]> {
      let current:GuildSummary[]|null=null;try{current=await directory.list(ownerId);}catch{/* Stored history remains readable; live writes still require assertEligible. */}
      for(const guild of current??[]) await db.query('INSERT INTO guilds(id,name,icon_url,bot_present) VALUES($1,$2,$3,true) ON CONFLICT(id) DO UPDATE SET name=$2,icon_url=$3,bot_present=true',[guild.id,guild.name,guild.iconUrl]);
      const stored=await db.query<{id:string;name:string;icon_url:string|null;active:boolean}>('SELECT id,name,icon_url,active FROM guilds ORDER BY name,id');
      const live=new Map((current??[]).map(g=>[g.id,g]));
      return stored.rows.map(g=>({id:g.id,name:g.name,iconUrl:g.icon_url,active:g.active&&live.has(g.id),eligible:live.get(g.id)?.eligible??false,...(current===null?{eligibilityUnavailable:true}:{})}));
    },
    async activate(ownerId:string,guildId:string) {
      await assertEligible(ownerId,guildId);
      await db.query('INSERT INTO guilds(id,active,bot_present) VALUES($1,true,true) ON CONFLICT(id) DO UPDATE SET active=true,bot_present=true',[guildId]);
      return {id:guildId,active:true};
    },
  };
}
export type GuildService=ReturnType<typeof createGuildService>;
// Explicit context keeps authorization independent of module-global application state.
export async function assertGuildWrite(ownerId:string,guildId:string,service:GuildService):Promise<void> {await service.assertGuildWrite(ownerId,guildId);}


