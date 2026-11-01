import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {snowflakeSchema,reasonSchema,ruleActionSchema} from '@eousbot/contracts';
import type {ModerationCase} from '@eousbot/contracts';
import type {AppDb} from '../../db/client.js';
import {withTransaction} from '../../db/client.js';
import {withMemberLock} from '../../db/locks.js';
import type {Clock} from '../../core/clock.js';
import {AppError} from '../../core/errors.js';
import {createIncidentRepository} from './incidents.js';
import type {IncidentIntent} from './incidents.js';
import type {EnforcementService} from './enforcement.js';
import {createCaseRepository} from './cases.js';
import {assertCommandAuthority} from './commands.js';
import type {CommandAuthority,ModerationRequest} from './commands.js';
export async function enqueueCommand(db:AppDb,clock:Clock,intent:IncidentIntent):Promise<string>{
 return withTransaction(db,tx=>withMemberLock(tx,intent.guildId,intent.userId,async()=>{
  const active=await tx.query('SELECT 1 FROM guilds WHERE id=$1 AND active AND bot_present',[intent.guildId]);if(!active.rowCount)throw new AppError('forbidden','Server is inactive');
  const existing=(await tx.query<{id:string}>('SELECT id FROM moderation_incidents WHERE guild_id=$1 AND operation_key=$2',[intent.guildId,intent.operationKey])).rows[0];if(existing)return existing.id;
  await createIncidentRepository(db).create(tx,{...intent,createdAt:clock.now()});return intent.id;
 }));
}
export async function dispatchCommand(db:AppDb,enforcement:EnforcementService,guildId:string,id:string):Promise<ModerationCase>{
 try{await enforcement.dispatch(id);}catch(error){if(!(error instanceof AppError)||error.code!=='conflict')throw error;}
 const result=await createCaseRepository(db).get(guildId,id);if(!result)throw new AppError('unavailable','Recorded case is temporarily unavailable');return result;
}
export function createModerationActions(deps:{db:AppDb;clock:Clock;authority:CommandAuthority;enforcement:EnforcementService}) {
 return {async request(input:ModerationRequest):Promise<ModerationCase>{
  const guildId=snowflakeSchema.parse(input.guildId),actorId=snowflakeSchema.parse(input.actorId),userId=snowflakeSchema.parse(input.targetId);
  const command=z.enum(['warn','timeout','kick','ban']).parse(input.command),operationKey=z.string().min(1).max(200).parse(input.operationKey),reason=reasonSchema.parse(input.reason).replaceAll('@','@\u200b').slice(0,512);
  const state=await deps.authority.inspect(guildId,actorId,userId);if(state.guildId!==guildId||state.actorId!==actorId||state.targetId!==userId)throw new AppError('unavailable','Current member identity is unavailable');assertCommandAuthority(command,state);
  const action=command==='warn'?null:ruleActionSchema.parse(command==='timeout'?{kind:'timeout',durationSeconds:input.durationSeconds}:{kind:command});
  const intent:IncidentIntent={id:randomUUID(),guildId,userId,actorId,source:'command',command,reason,operationKey:'command:'+operationKey,action,contributors:[],cleanupMessages:[],createdAt:deps.clock.now(),mode:'punish',parentIncidentId:null};
  const id=await enqueueCommand(deps.db,deps.clock,intent);return dispatchCommand(deps.db,deps.enforcement,guildId,id);
 }};
}

