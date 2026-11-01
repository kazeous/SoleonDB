import type {RolePickerInput} from '@eousbot/contracts';
import type {AppDb,SqlSession} from '../../db/client.js';
export interface RolePanel {id:string;guildId:string;channelId:string;messageId:string|null;state:string;operationKey:string;input:RolePickerInput}
export interface RoleOperation {id:string;guild_id:string;panel_id:string;role_id:string;user_id:string;desired:boolean;state:string}
export async function assertVerificationRoleAvailable(session:SqlSession,guildId:string,roleId:string):Promise<void>{
 const current=await session.query<{value:{roleId:string|null}}>('SELECT value FROM feature_settings WHERE guild_id=$1 AND feature=$2',[guildId,'verification']);
 const old=await session.query("SELECT 1 FROM verification_panels p WHERE p.guild_id=$1 AND p.role_id=$2 AND (p.active OR p.state IN ('creating','unknown') OR EXISTS(SELECT 1 FROM verification_assignments a WHERE a.guild_id=p.guild_id AND a.generation=p.generation AND (a.role_granted OR a.operation<>'none'))) LIMIT 1",[guildId,roleId]);
 if(current.rows[0]?.value.roleId===roleId||old.rowCount)throw new Error('Role is reserved for verification');
}
export function createRolePickerRepository(db:AppDb) {
 async function decode(row:{id:string;guild_id:string;channel_id:string;message_id:string|null;state:string;operation_key:string;title:string;description:string}):Promise<RolePanel>{
  const options=(await db.query<{role_id:string;label:string;emoji:string|null}>('SELECT role_id,label,emoji FROM role_picker_options WHERE guild_id=$1 AND panel_id=$2 ORDER BY position',[row.guild_id,row.id])).rows;
  return {id:row.id,guildId:row.guild_id,channelId:row.channel_id,messageId:row.message_id,state:row.state,operationKey:row.operation_key,input:{title:row.title,description:row.description,roles:options.map(option=>({roleId:option.role_id,label:option.label,...(option.emoji?{emoji:option.emoji}:{})}))}};
 }
 return {
  async byMessage(guildId:string,messageId:string):Promise<RolePanel|null>{const row=(await db.query('SELECT * FROM role_picker_panels WHERE guild_id=$1 AND message_id=$2 AND state=$3',[guildId,messageId,'ready'])).rows[0];return row?decode(row as Parameters<typeof decode>[0]):null;},
  async byOperation(guildId:string,key:string):Promise<RolePanel|null>{const row=(await db.query('SELECT * FROM role_picker_panels WHERE guild_id=$1 AND operation_key=$2',[guildId,key])).rows[0];return row?decode(row as Parameters<typeof decode>[0]):null;},
  async operation(guildId:string,key:string):Promise<RoleOperation|null>{return (await db.query<RoleOperation>('SELECT * FROM role_picker_operations WHERE guild_id=$1 AND id=$2',[guildId,key])).rows[0]??null;},
  async unfinished(guildId:string,userId:string,roleId:string):Promise<RoleOperation[]>{return (await db.query<RoleOperation>("SELECT * FROM role_picker_operations WHERE guild_id=$1 AND user_id=$2 AND role_id=$3 AND state IN ('dispatching','unknown') ORDER BY created_at",[guildId,userId,roleId])).rows;},
 };
}

