import type {VerificationBinding} from './repository.js';
interface ReactionBase {guildId:string;channelId:string;messageId:string}
export type ReactionEvent=(ReactionBase&{kind:'add'|'remove';userId:string;emojiKey:string;reactionType:'normal'|'burst'})|(ReactionBase&{kind:'remove_all'})|(ReactionBase&{kind:'remove_emoji';emojiKey:string});
export interface VerificationPort {
 validateSetup(guildId:string,channelId:string,roleId:string,emojiRender:string,actorId:string):Promise<void>;
 fetchPanel(binding:VerificationBinding):Promise<'valid'|'missing'>;
 postPanel(binding:VerificationBinding,prompt:string):Promise<string>;
 findPanel(binding:VerificationBinding):Promise<string|null>;
 ensurePanelReaction(binding:VerificationBinding):Promise<void>;
 listReactors(binding:VerificationBinding,type:'normal'|'burst',cursor:string|null):Promise<{userIds:string[];nextCursor:string|null}>;
 memberRoleState(guildId:string,userId:string):Promise<{roleIds:string[];isBot:boolean;present:boolean}>;
 addRole(guildId:string,userId:string,roleId:string):Promise<void>;
 removeRole(guildId:string,userId:string,roleId:string):Promise<void>;
}
export interface ReconcileResult {added:number;removed:number;preserved:number;failed:number;complete:boolean}


export class VerificationPanelError extends Error {constructor(public readonly outcome:'not_sent'|'unknown',message:string){super(message);this.name='VerificationPanelError';}}
