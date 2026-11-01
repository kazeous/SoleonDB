import {cleanOptionsSchema} from '@eousbot/contracts';
import type {CleanOptions} from '@eousbot/contracts';
import {containsLink} from '../protection/matcher.js';
import {containsInvite} from '../automod/policy.js';
export interface CleanMessage {id:string;guildId:string;channelId:string;authorId:string;bot:boolean;content:string;createdAt:number;attachmentCount:number;embedCount:number}
export function selectCleanMessages(messages:CleanMessage[],input:CleanOptions,now:number):{selected:CleanMessage[];skipped:number} {
 const options=cleanOptionsSchema.parse(input),sample=messages.slice(0,options.amount);
 const selected=sample.filter(message=>{
  if(message.createdAt<now-14*86400000||options.userId&&message.authorId!==options.userId)return false;
  switch(options.filter){case 'only-bots':return message.bot;case 'only-users':return !message.bot;case 'contain-links':return containsLink(message.content);case 'contain-invites':return containsInvite(message.content);case 'text-only':return !!message.content&&message.attachmentCount===0&&message.embedCount===0;default:return true;}
 });return {selected,skipped:sample.length-selected.length};
}


import {randomUUID} from 'node:crypto';
import {snowflakeSchema} from '@eousbot/contracts';
import type {AppDb} from '../../db/client.js';
import type {Clock} from '../../core/clock.js';
import type {EnforcementService} from './enforcement.js';
import type {CommandAuthority} from './commands.js';
import {assertCommandAuthority} from './commands.js';
import {enqueueCommand,dispatchCommand} from './actions.js';
import {AppError} from '../../core/errors.js';
export function createCleanService(deps:{db:AppDb;clock:Clock;authority:CommandAuthority;enforcement:EnforcementService;port:{list(guildId:string,channelId:string,limit:number):Promise<CleanMessage[]>}}) {
 return {async run(input:CleanOptions&{guildId:string;channelId:string;actorId:string;operationKey:string}){
  const {guildId,channelId,actorId,operationKey,...raw}=input,options=cleanOptionsSchema.parse(raw);snowflakeSchema.parse(guildId);snowflakeSchema.parse(channelId);snowflakeSchema.parse(actorId);
  assertCommandAuthority('clean',await deps.authority.inspect(guildId,actorId,null));
  const sample=await deps.port.list(guildId,channelId,options.amount);
  if(sample.some(message=>message.guildId!==guildId||message.channelId!==channelId))throw new AppError('unavailable','Message channel identity is inconsistent');
  const selection=selectCleanMessages(sample,options,deps.clock.now());for(const message of selection.selected)snowflakeSchema.parse(message.id);
  const id=await enqueueCommand(deps.db,deps.clock,{id:randomUUID(),guildId,userId:options.userId??actorId,actorId,source:'command',command:'clean',reason:'Manual cleanup: '+options.filter,operationKey:'command:'+operationKey,action:null,contributors:[],cleanupMessages:selection.selected.map(message=>({channelId,messageId:message.id})),createdAt:deps.clock.now(),mode:'cleanup_only',parentIncidentId:null});
  const result=await dispatchCommand(deps.db,deps.enforcement,guildId,id),outcome=result.outcome;
  return {deleted:outcome?.cleanup.deleted??0,skipped:selection.skipped+(outcome?.cleanup.missing??0),failed:outcome?.cleanup.failed??0,caseNumber:result.number,state:outcome?.state??'unknown'};
 }};
}
