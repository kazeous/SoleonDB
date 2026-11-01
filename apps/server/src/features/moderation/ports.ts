import type {IncidentIntent} from './incidents.js';
export interface TargetEligibility {isOwner:boolean;isAdministrator:boolean;botCanTimeout:boolean;botCanKick:boolean;botCanBan:boolean;timeoutUntil:number|null;roleIds:string[]}
export interface ModerationPort {
 inspect(guildId:string,userId:string):Promise<TargetEligibility>;
 timeout(guildId:string,userId:string,until:number,reason:string):Promise<void>;
 kick(guildId:string,userId:string,reason:string):Promise<void>;
 ban(guildId:string,userId:string,reason:string):Promise<void>;
 deleteMessage(guildId:string,channelId:string,messageId:string):Promise<'deleted'|'missing'>;
 lookupOutcome(intent:IncidentIntent):Promise<'applied'|'not_applied'|'unknown'>;
}
export interface RelatedMessageStore {list(guildId:string,sourceMessageId:string):Promise<Array<{channelId:string;messageId:string}>>}
export class ModerationEffectError extends Error {
 constructor(public readonly outcome:'rejected'|'unknown',message:string){super(message);this.name='ModerationEffectError';}
}

