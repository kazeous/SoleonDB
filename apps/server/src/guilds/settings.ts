import type {FeatureConfigMap,SettingsKey,Versioned} from '@eousbot/contracts';
import {settingsSchemas,settingsDefaults,isSettingsKey,moderationConfigSchema,rolesConfigSchema,verificationConfigSchema} from '@eousbot/contracts';
import type {AppDb,SqlSession} from '../db/client.js';
import {withTransaction} from '../db/client.js';
import {withConfigLock} from '../db/locks.js';
import type {Clock} from '../core/clock.js';
import {AppError} from '../core/errors.js';
export function createSettingsService(db:AppDb,clock:Clock) {
  function validate<K extends SettingsKey>(key:K,input:unknown):FeatureConfigMap[K] {
    if(!isSettingsKey(key)) throw new AppError('validation','Unknown feature settings');
    const result=settingsSchemas[key].safeParse(input);
    if(!result.success) throw new AppError('validation','Invalid feature settings',Object.fromEntries(result.error.issues.map(i=>[i.path.join('.'),'Invalid value'])));
    return result.data;
  }
  async function readAt<K extends SettingsKey>(session:SqlSession,guildId:string,key:K):Promise<Versioned<FeatureConfigMap[K]>> {
    if(!isSettingsKey(key)) throw new AppError('validation','Unknown feature settings');
    const result=await session.query<{revision:number;value:unknown}>('SELECT revision,value FROM feature_settings WHERE guild_id=$1 AND feature=$2',[guildId,key]);
    const row=result.rows[0];
    return row ? {revision:row.revision,value:validate(key,row.value)} : {revision:0,value:structuredClone(settingsDefaults[key])};
  }
  return {
    read:<K extends SettingsKey>(guildId:string,key:K)=>readAt(db,guildId,key),
    async update<K extends SettingsKey>(guildId:string,key:K,input:FeatureConfigMap[K],expectedRevision:number,actorId:string):Promise<Versioned<FeatureConfigMap[K]>> {
      const value=validate(key,input);
      if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0) throw new AppError('validation','Invalid revision');
      return withTransaction(db,tx=>withConfigLock(tx,guildId,async()=>{
        if(key==='roles'){
          const roles=rolesConfigSchema.parse(value),verification=await readAt(tx,guildId,'verification');
          for(const roleId of roles.assignableRoleIds){
            const reserved=await tx.query("SELECT 1 FROM verification_panels p WHERE p.guild_id=$1 AND p.role_id=$2 AND (p.active OR p.state IN ('creating','unknown') OR EXISTS(SELECT 1 FROM verification_assignments a WHERE a.guild_id=p.guild_id AND a.generation=p.generation AND (a.role_granted OR a.operation<>'none'))) LIMIT 1",[guildId,roleId]);
            if(verification.value.roleId===roleId||reserved.rowCount)throw new AppError('validation','Use a separate role for verification and role pickers');
          }
        }
        if(key==='verification'){
          const verification=verificationConfigSchema.parse(value),roles=await readAt(tx,guildId,'roles');
          const bound=verification.roleId?await tx.query("SELECT 1 FROM role_picker_options o JOIN role_picker_panels p ON p.guild_id=o.guild_id AND p.id=o.panel_id WHERE o.guild_id=$1 AND o.role_id=$2 AND p.state IN ('creating','unknown','ready') LIMIT 1",[guildId,verification.roleId]):null;
          if(verification.roleId&&(roles.value.assignableRoleIds.includes(verification.roleId)||bound?.rowCount))throw new AppError('validation','Use a dedicated verified role that is not bound to a role picker');
        }
        const current=await readAt(tx,guildId,key);
        if(current.revision!==expectedRevision) throw new AppError('conflict','Settings changed. Reload before saving.');
        const logChannelId=key==='moderation' ? moderationConfigSchema.parse(value).logChannelId : null;
        if(logChannelId) {
          const local=await tx.query('SELECT 1 FROM guild_channels WHERE guild_id=$1 AND id=$2 AND type=$3',[guildId,logChannelId,'text']);
          if(!local.rowCount) throw new AppError('validation','Choose a text channel in this server',{logChannelId:'Invalid channel'});
        }
        const revision=current.revision+1;
        await tx.query('INSERT INTO feature_settings(guild_id,feature,revision,value,log_channel_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(guild_id,feature) DO UPDATE SET revision=$3,value=$4,log_channel_id=$5',[guildId,key,revision,value,logChannelId]);
        await tx.query('INSERT INTO configuration_audit(guild_id,actor_id,feature,previous_value,new_value,created_at) VALUES($1,$2,$3,$4,$5,$6)',[guildId,actorId,key,current.value,value,clock.now()]);
        return {revision,value};
      }));
    },
  };
}
export type SettingsService=ReturnType<typeof createSettingsService>;

