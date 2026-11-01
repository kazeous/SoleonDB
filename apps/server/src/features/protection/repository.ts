import type {ChannelRule} from '@eousbot/contracts';
import {channelRuleSchema} from '@eousbot/contracts';
import type {AppDb,SqlSession} from '../../db/client.js';
interface RuleRow {id:string;guild_id:string;revision:number;config:unknown}
function decode(row:RuleRow):ChannelRule {return channelRuleSchema.parse({...row.config as object,id:row.id,guildId:row.guild_id,revision:row.revision});}
export function createRuleRepository(db:AppDb) {
 return {
  async forChannel(session:SqlSession,guildId:string,channelId:string):Promise<ChannelRule[]> {return (await session.query<RuleRow>('SELECT id,guild_id,revision,config FROM channel_rules WHERE guild_id=$1 AND channel_id=$2 AND enabled AND deleted_at IS NULL ORDER BY id',[guildId,channelId])).rows.map(decode);},
  async list(guildId:string):Promise<ChannelRule[]> {return (await db.query<RuleRow>('SELECT id,guild_id,revision,config FROM channel_rules WHERE guild_id=$1 AND deleted_at IS NULL ORDER BY id',[guildId])).rows.map(decode);},
  async current(session:SqlSession,guildId:string,ruleId:string):Promise<ChannelRule|null> {const row=(await session.query<RuleRow>('SELECT id,guild_id,revision,config FROM channel_rules WHERE guild_id=$1 AND id=$2 AND deleted_at IS NULL',[guildId,ruleId])).rows[0];return row?decode(row):null;},
  async hasEnabledInChannel(guildId:string,channelId:string):Promise<boolean> {return (await db.query('SELECT 1 FROM channel_rules WHERE guild_id=$1 AND channel_id=$2 AND enabled AND deleted_at IS NULL LIMIT 1',[guildId,channelId])).rowCount!==0;},
 };
}
export type RuleRepository=ReturnType<typeof createRuleRepository>;

