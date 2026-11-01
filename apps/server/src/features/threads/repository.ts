import type {AppDb} from '../../db/client.js';
import {withTransaction} from '../../db/client.js';
import {withConfigLock} from '../../db/locks.js';
import type {Clock} from '../../core/clock.js';
import {threadsConfigSchema} from '@eousbot/contracts';
import type {ThreadsConfig} from '@eousbot/contracts';
import {AppError} from '../../core/errors.js';
export interface AutoThreadRecord{guildId:string;messageId:string;channelId:string;threadId:string|null;state:string;settingsRevision:number;name:string;autoArchiveDuration:ThreadsConfig['autoArchiveDuration']}
const columns='guild_id AS "guildId",message_id AS "messageId",channel_id AS "channelId",thread_id AS "threadId",state,settings_revision AS "settingsRevision",name,auto_archive_duration AS "autoArchiveDuration"';
export function createAutoThreadRepository(db:AppDb,clock:Clock){return {
 async reserve(guildId:string,channelId:string,messageId:string,name:string,revision:number){await withTransaction(db,tx=>withConfigLock(tx,guildId,async()=>{const current=(await tx.query<{revision:number;value:unknown}>('SELECT revision,value FROM feature_settings WHERE guild_id=$1 AND feature=$2',[guildId,'threads'])).rows[0],config=threadsConfigSchema.parse(current?.value);if(current?.revision!==revision||!config.enabled||!config.channelIds.includes(channelId))throw new AppError('conflict','Thread settings changed');await tx.query('INSERT INTO guild_channels(guild_id,id,name,type) VALUES($1,$2,$2,$3) ON CONFLICT DO NOTHING',[guildId,channelId,'text']);await tx.query("INSERT INTO auto_threads(guild_id,channel_id,message_id,name,settings_revision,auto_archive_duration,state) VALUES($1,$2,$3,$4,$5,$6,'pending') ON CONFLICT DO NOTHING",[guildId,channelId,messageId,name,revision,config.autoArchiveDuration]);}));},
 async read(guildId:string,messageId:string){return (await db.query<AutoThreadRecord>('SELECT '+columns+' FROM auto_threads WHERE guild_id=$1 AND message_id=$2',[guildId,messageId])).rows[0]??null;},
 async claim(guildId:string,messageId:string){return (await db.query("UPDATE auto_threads SET lease_until=$3,last_attempt_at=$4 WHERE guild_id=$1 AND message_id=$2 AND state IN ('pending','creating','unknown') AND lease_until<=$4",[guildId,messageId,clock.now()+60000,clock.now()])).rowCount===1;},
 async mark(guildId:string,messageId:string,state:string,threadId?:string){await db.query('UPDATE auto_threads SET state=$3,thread_id=COALESCE($4,thread_id) WHERE guild_id=$1 AND message_id=$2',[guildId,messageId,state,threadId??null]);},
 async release(guildId:string,messageId:string){await db.query('UPDATE auto_threads SET lease_until=0 WHERE guild_id=$1 AND message_id=$2',[guildId,messageId]);},
 async pending(guildId:string){return (await db.query<AutoThreadRecord>('SELECT '+columns+" FROM auto_threads WHERE guild_id=$1 AND state IN ('pending','creating','unknown') AND lease_until<=$2 ORDER BY last_attempt_at,message_id LIMIT 100",[guildId,clock.now()])).rows;},
};}
