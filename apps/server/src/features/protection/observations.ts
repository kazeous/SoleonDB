import type {ChannelRule} from '@eousbot/contracts';
import type {AppDb,AppTx} from '../../db/client.js';
import type {MessageSnapshot} from '../../discord/messages.js';
export function createObservationRepository(db:AppDb) {
 return {
  async record(tx:AppTx,rule:ChannelRule,message:MessageSnapshot,now:number):Promise<boolean>{
   return (await tx.query('INSERT INTO rule_matches(guild_id,rule_id,revision,message_id,channel_id,user_id,matched_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING message_id',[rule.guildId,rule.id,rule.revision,message.id,message.channelId,message.userId,now,now+rule.threshold.windowSeconds*1000])).rowCount===1;
  },
  async active(tx:AppTx,rule:ChannelRule,userId:string,now:number):Promise<Array<{messageId:string;channelId:string}>>{
   return (await tx.query<{message_id:string;channel_id:string}>('SELECT message_id,channel_id FROM rule_matches WHERE guild_id=$1 AND rule_id=$2 AND revision=$3 AND user_id=$4 AND expires_at>$5 AND consumed_at IS NULL ORDER BY matched_at,message_id',[rule.guildId,rule.id,rule.revision,userId,now])).rows.map(row=>({messageId:row.message_id,channelId:row.channel_id}));
  },
  async consume(tx:AppTx,guildId:string,userId:string,now:number,rules?:Array<{ruleId:string;revision:number}>):Promise<void>{
   if(!rules)await tx.query('UPDATE rule_matches SET consumed_at=$3 WHERE guild_id=$1 AND user_id=$2 AND consumed_at IS NULL',[guildId,userId,now]);
   else for(const rule of rules)await tx.query('UPDATE rule_matches SET consumed_at=$5 WHERE guild_id=$1 AND user_id=$2 AND rule_id=$3 AND revision=$4 AND consumed_at IS NULL',[guildId,userId,rule.ruleId,rule.revision,now]);
  },
  async prune(now:number,limit:number):Promise<void>{await db.query('DELETE FROM rule_matches WHERE (guild_id,rule_id,revision,message_id) IN (SELECT guild_id,rule_id,revision,message_id FROM rule_matches WHERE expires_at<=$1 ORDER BY expires_at LIMIT $2)',[now,Math.min(1000,Math.max(1,limit))]);},
 };
}

