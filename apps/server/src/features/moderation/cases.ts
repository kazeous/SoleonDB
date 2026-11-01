import {z} from 'zod';
import type {AppDb} from '../../db/client.js';
import type {CaseOutcome,IncidentIntent} from './incidents.js';
import type {ChannelRule} from '@eousbot/contracts';
import type {CaseFilter,ModerationCase,CasePage} from '@eousbot/contracts';
export type {CaseFilter,ModerationCase,CasePage} from '@eousbot/contracts';
interface CaseRow {id:string;guild_id:string;number:number;target_id:string;actor_id:string|null;source:IncidentIntent['source'];action:ModerationCase['action'];duration_seconds:number|null;policy_snapshot:ModerationCase['policySnapshot'];reason:string;rule_snapshot:ChannelRule[];created_at:string;outcome:CaseOutcome|null}
function decode(row:CaseRow):ModerationCase {return {id:row.id,guildId:row.guild_id,number:row.number,targetId:row.target_id,actorId:row.actor_id,source:row.source,action:row.action,reason:row.reason,ruleSnapshot:row.rule_snapshot,createdAt:Number(row.created_at),durationSeconds:row.duration_seconds,policySnapshot:row.policy_snapshot,outcome:row.outcome};}
export function createCaseRepository(db:AppDb) {
 return {
  async list(guildId:string,filter:CaseFilter={},cursor:string|null=null,limit=25):Promise<CasePage>{
   z.number().int().min(1).max(100).parse(limit);
   const values:unknown[]=[guildId],clauses=['guild_id=$1'];
   function condition(sql:string,value:unknown){values.push(value);clauses.push(sql.replace('?',String(values.length)));}
   if(filter.memberId)condition('target_id=$?',filter.memberId);if(filter.action)condition('action=$?',filter.action);if(filter.source)condition('source=$?',filter.source);if(filter.outcome)condition("outcome->>'state'=$?",filter.outcome);
   if(filter.from!==undefined)condition('created_at>=$?',filter.from);if(filter.to!==undefined)condition('created_at<=$?',filter.to);
   if(cursor){const parsed=z.strictObject({at:z.number().int().nonnegative(),id:z.uuid()}).parse(JSON.parse(Buffer.from(cursor,'base64url').toString()));values.push(parsed.at,parsed.id);clauses.push('(created_at,id)<($'+(values.length-1)+',$'+values.length+'::uuid)');}
   values.push(limit+1);const rows=(await db.query<CaseRow>('SELECT * FROM moderation_cases WHERE '+clauses.join(' AND ')+' ORDER BY created_at DESC,id DESC LIMIT $'+values.length,values)).rows;
   const items=rows.slice(0,limit).map(decode),last=items.at(-1);
   return {items,nextCursor:rows.length>limit&&last?Buffer.from(JSON.stringify({at:last.createdAt,id:last.id})).toString('base64url'):null};
  },
  async get(guildId:string,id:string):Promise<ModerationCase|null>{const row=(await db.query<CaseRow>('SELECT * FROM moderation_cases WHERE guild_id=$1 AND id=$2',[guildId,id])).rows[0];return row?decode(row):null;},
 };
}
export type CaseRepository=ReturnType<typeof createCaseRepository>;

