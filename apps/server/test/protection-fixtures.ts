import {randomUUID} from 'node:crypto';
import type {AppDb} from '../src/db/client.js';
import type {RuleInput,ChannelRule} from '@eousbot/contracts';
import {seedGuild} from './database.js';
export async function seedRule(db:AppDb,overrides:Partial<RuleInput>&{guildId?:string;id?:string}={}):Promise<ChannelRule>{
 const {guildId='9223372036854775807',id=randomUUID(),...patch}=overrides;await seedGuild(db,guildId);
 const config:RuleInput={name:'Protection',channelId:'111111111111111111',enabled:true,trigger:{kind:'link'},threshold:{count:3,windowSeconds:10},action:{kind:'timeout',durationSeconds:3600},exemptUserIds:[],exemptRoleIds:[],...patch};
 await db.query('INSERT INTO guild_channels(guild_id,id,name,type) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[guildId,config.channelId,'protected','text']);
 await db.query('INSERT INTO channel_rules(guild_id,id,channel_id,enabled,config) VALUES($1,$2,$3,$4,$5)',[guildId,id,config.channelId,config.enabled,config]);return {...config,guildId,id,revision:1};
}
export async function intents(db:AppDb,userId='123456789012345678'){
 return (await db.query<{intent:import('../src/features/moderation/incidents.js').IncidentIntent}>('SELECT intent FROM moderation_incidents WHERE user_id=$1 ORDER BY created_at,id',[userId])).rows.map(r=>r.intent);
}

