import type {ModerationCommand,CleanOptions,ModerationCase} from '@eousbot/contracts';
import {snowflakeSchema,reasonSchema} from '@eousbot/contracts';
import type {CommandRouter} from '../../discord/interactions.js';
import type {CaseRepository} from './cases.js';
import {AppError} from '../../core/errors.js';
export interface CommandAuthoritySnapshot {guildId:string;actorId:string;targetId:string|null;ownerId:string;botId:string;actorPermissions:string;actorPosition:number;botPosition:number;targetPosition:number|null}
export interface CommandAuthority {inspect(guildId:string,actorId:string,targetId:string|null):Promise<CommandAuthoritySnapshot>}
export const requiredPermission:Record<ModerationCommand,bigint>={warn:2n,cases:2n,kick:2n,timeout:1099511627776n,ban:4n,clean:8192n};
export function assertCommandAuthority(command:ModerationCommand,state:CommandAuthoritySnapshot):void {
 const owner=state.actorId===state.ownerId,permissions=BigInt(state.actorPermissions);
 if(!owner&&(permissions&8n)===0n&&(permissions&requiredPermission[command])===0n)throw new AppError('forbidden','You lack the Discord permission for this command');
 if(command==='cases'||command==='clean')return;
 if(!state.targetId||[state.actorId,state.botId,state.ownerId].includes(state.targetId))throw new AppError('forbidden','You cannot target yourself, this bot, or the server owner');
 if(state.targetPosition===null){if(command==='timeout'||command==='kick')throw new AppError('not_found','Target is not a server member');return;}
 if(state.botPosition<=state.targetPosition||!owner&&state.actorPosition<=state.targetPosition)throw new AppError('forbidden','The actor and bot roles must be above the target');
}
export interface ModerationRequest {guildId:string;actorId:string;targetId:string;command:'warn'|'timeout'|'kick'|'ban';reason:string;durationSeconds?:number;operationKey:string}
interface CommandDeps {authority:CommandAuthority;actions:{request(input:ModerationRequest):Promise<ModerationCase>};cases:Pick<CaseRepository,'list'>;clean:{run(input:CleanOptions&{guildId:string;channelId:string;actorId:string;operationKey:string}):Promise<{deleted:number;skipped:number;failed:number;caseNumber:number;state?:string}>}}
function id(input:unknown):string {const result=snowflakeSchema.safeParse(input);if(!result.success)throw new AppError('validation','Select a valid server member');return result.data;}
export function registerModerationCommands(router:CommandRouter,deps:CommandDeps):void {
 for(const command of ['warn','timeout','kick','ban','cases','clean'] as const)router.register({kind:'command',name:command,handler:async context=>{
  const guildId=context.guildId!,actorId=context.userId!,targetId=context.options.user===undefined?null:id(context.options.user);
  const state=await deps.authority.inspect(guildId,actorId,targetId);assertCommandAuthority(command,state);
  if(command==='cases'){if(!targetId)throw new AppError('validation','Select a member for case history');const page=await deps.cases.list(guildId,{memberId:targetId},null,10);await context.edit(page.items.length?page.items.map(row=>'Case #'+row.number+' · '+row.action+' · '+(row.outcome?.state??'pending')+' · '+row.reason).join('\n').slice(0,1900):'No recorded cases for this member in this server.');return;}
  if(command==='clean'){const amount=context.options.amount;if(typeof amount!=='number'||!Number.isInteger(amount)||amount<1||amount>100)throw new AppError('validation','Amount must be 1–100 messages');const result=await deps.clean.run({guildId,channelId:context.channelId!,actorId,operationKey:context.id,amount,...(targetId?{userId:targetId}:{}),...(typeof context.options.filter==='string'?{filter:context.options.filter as CleanOptions['filter']}: {})});await context.edit('Deleted '+result.deleted+'; skipped '+result.skipped+'; failed '+result.failed+'. Case #'+result.caseNumber+' · '+(result.state??'completed'));return;}
  if(!targetId)throw new AppError('validation','Select a target member');
  let durationSeconds:number|undefined;if(command==='timeout'){const duration=context.options.duration;if(typeof duration!=='number'||!Number.isInteger(duration)||duration<1||duration>40320)throw new AppError('validation','Timeout duration must be 1–40320 minutes');durationSeconds=duration*60;}
  const parsed=reasonSchema.safeParse(context.options.reason);if(!parsed.success)throw new AppError('validation','Reason must contain 1–512 characters');
  const result=await deps.actions.request({guildId,actorId,targetId,command,operationKey:context.id,reason:parsed.data,...(durationSeconds===undefined?{}:{durationSeconds})});await context.edit('Case #'+result.number+' · '+(result.outcome?.state??'pending')+'.');
 }});
}

