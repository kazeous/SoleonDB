import {randomUUID} from 'node:crypto';
import type {AppDb} from '../../db/client.js';
import {withTransaction} from '../../db/client.js';
import {withConfigLock} from '../../db/locks.js';
import type {Clock} from '../../core/clock.js';
export interface StarboardMapping{guildId:string;sourceMessageId:string;sourceChannelId:string;destinationId:string;repostId:string|null;operationId:string;state:string;starCount:number;sourceDeleted:boolean}
const columns='guild_id AS "guildId",source_message_id AS "sourceMessageId",source_channel_id AS "sourceChannelId",destination_id AS "destinationId",repost_id AS "repostId",operation_id AS "operationId",state,star_count AS "starCount",source_deleted AS "sourceDeleted"';
export function createStarboardRepository(db:AppDb,clock:Clock){return {
 async ensure(guildId:string,sourceChannelId:string,sourceMessageId:string,destinationId:string){await withTransaction(db,tx=>withConfigLock(tx,guildId,async()=>{for(const id of [sourceChannelId,destinationId])await tx.query('INSERT INTO guild_channels(guild_id,id,name,type) VALUES($1,$2,$2,$3) ON CONFLICT(guild_id,id) DO NOTHING',[guildId,id,'text']);await tx.query("INSERT INTO starboard_mappings(guild_id,source_channel_id,source_message_id,destination_id,operation_id,state) VALUES($1,$2,$3,$4,$5,'idle') ON CONFLICT DO NOTHING",[guildId,sourceChannelId,sourceMessageId,destinationId,randomUUID()]);}));},
 async read(guildId:string,messageId:string){return (await db.query<StarboardMapping>('SELECT '+columns+' FROM starboard_mappings WHERE guild_id=$1 AND source_message_id=$2',[guildId,messageId])).rows[0]??null;},
 async claim(guildId:string,messageId:string){return (await db.query('UPDATE starboard_mappings SET lease_until=$3,last_synced_at=$4 WHERE guild_id=$1 AND source_message_id=$2 AND lease_until<=$4',[guildId,messageId,clock.now()+60000,clock.now()])).rowCount===1;},
 async release(guildId:string,messageId:string){await db.query('UPDATE starboard_mappings SET lease_until=0 WHERE guild_id=$1 AND source_message_id=$2',[guildId,messageId]);},
 async beginPost(guildId:string,messageId:string,destinationId:string,count:number){const operationId=randomUUID();await db.query("UPDATE starboard_mappings SET destination_id=$3,operation_id=$4,state='creating',repost_id=NULL,star_count=$5 WHERE guild_id=$1 AND source_message_id=$2",[guildId,messageId,destinationId,operationId,count]);return operationId;},
 async posted(guildId:string,messageId:string,repostId:string,count:number){await db.query("UPDATE starboard_mappings SET repost_id=$3,state='ready',star_count=$4 WHERE guild_id=$1 AND source_message_id=$2",[guildId,messageId,repostId,count]);},
 async unknown(guildId:string,messageId:string){await db.query("UPDATE starboard_mappings SET state='unknown' WHERE guild_id=$1 AND source_message_id=$2",[guildId,messageId]);},
 async removed(guildId:string,messageId:string){await db.query("UPDATE starboard_mappings SET repost_id=NULL,state='removed',star_count=0 WHERE guild_id=$1 AND source_message_id=$2",[guildId,messageId]);},
 async sourceDeleted(guildId:string,messageId:string){await db.query('UPDATE starboard_mappings SET source_deleted=true WHERE guild_id=$1 AND source_message_id=$2',[guildId,messageId]);},
 async oldest(guildId:string,limit=100){return (await db.query<{source_channel_id:string;source_message_id:string}>('SELECT source_channel_id,source_message_id FROM starboard_mappings WHERE guild_id=$1 AND (NOT source_deleted OR repost_id IS NOT NULL OR state IN ($2,$3)) ORDER BY last_synced_at,source_message_id LIMIT $4',[guildId,'unknown','creating',limit])).rows;},
};}
