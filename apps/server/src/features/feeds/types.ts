import type {FeedItem,FeedSource} from '@eousbot/contracts';
export type {FeedItem,FeedSource} from '@eousbot/contracts';
export interface FeedProvider{poll(source:FeedSource,cursor:string|null):Promise<{items:FeedItem[];cursor:string|null}>}
export interface DeliveryResult{delivered:number;skipped:number;state:'ok'|'degraded'|'unknown'}
export class FeedProviderError extends Error{constructor(public readonly kind:'setup'|'unavailable'|'rate_limit',message:string,public readonly retryAfterMs?:number){super(message);}}
export class FeedSendCancelled extends Error{constructor(){super('Feed delivery cancelled before dispatch');}}
export interface FeedPort{destination(guildId:string,channelId:string):Promise<boolean>;send(guildId:string,channelId:string,operationId:string,item:FeedItem,authorize:()=>Promise<boolean>):Promise<string>;findAccepted(guildId:string,channelId:string,operationId:string,messageId?:string|null):Promise<string|null>}
