import {assertOutsideTransaction} from '../src/db/client.js';
import type {AppDb} from '../src/db/client.js';
import type {ModerationPort,TargetEligibility} from '../src/features/moderation/ports.js';
import {ModerationEffectError,ModerationSendCancelled} from '../src/features/moderation/ports.js';
import type {IncidentIntent} from '../src/features/moderation/incidents.js';
export class FakeModerationPort implements ModerationPort {
 target:TargetEligibility={isOwner:false,isAdministrator:false,botCanTimeout:true,botCanKick:true,botCanBan:true,timeoutUntil:null,roleIds:[]};
 calls:Array<{kind:string;guildId:string;userId?:string;messageId?:string;until?:number;reason?:string}>=[];
 deleted=new Set<string>();missing=new Set<string>();failDelete=false;failPunish=false;ambiguousPunish=false;maximumDeletes=0;private deleting=0;
 accepted=new Set<string>();lookup:'applied'|'not_applied'|'unknown'='applied';onInspect?:()=>Promise<void>;onDelete?:(messageId:string)=>Promise<void>;onDeleted?:(messageId:string)=>Promise<void>;
 constructor(private readonly db:AppDb){}
 async outside(){assertOutsideTransaction();}
 async inspect(_guildId:string,_userId:string){await this.outside();await this.onInspect?.();return structuredClone(this.target);}
 async timeout(guildId:string,userId:string,until:number,reason:string,beforeSend?:()=>Promise<boolean>){await this.punish('timeout',guildId,userId,reason,until,beforeSend);}
 async kick(guildId:string,userId:string,reason:string,beforeSend?:()=>Promise<boolean>){await this.punish('kick',guildId,userId,reason,undefined,beforeSend);}
 async ban(guildId:string,userId:string,reason:string,beforeSend?:()=>Promise<boolean>){await this.punish('ban',guildId,userId,reason,undefined,beforeSend);}
 private async punish(kind:string,guildId:string,userId:string,reason:string,until?:number,beforeSend?:()=>Promise<boolean>){
  await this.outside();if(beforeSend&&!await beforeSend())throw new ModerationSendCancelled();this.calls.push({kind,guildId,userId,reason,...(until===undefined?{}:{until})});
  if(this.failPunish)throw new ModerationEffectError('rejected','Discord rejected action');
  this.accepted.add(reason);if(this.ambiguousPunish)throw new ModerationEffectError('unknown','Request outcome unknown');
 }
 async deleteMessage(guildId:string,_channelId:string,messageId:string,beforeSend?:()=>Promise<boolean>):Promise<'deleted'|'missing'>{
  await this.outside();this.deleting++;this.maximumDeletes=Math.max(this.maximumDeletes,this.deleting);
  try {await new Promise(resolve=>setTimeout(resolve,5));await this.onDelete?.(messageId);if(beforeSend&&!await beforeSend())throw new ModerationSendCancelled();this.calls.push({kind:'delete',guildId,messageId});if(this.failDelete)throw new ModerationEffectError('rejected','No deletion permission');if(this.missing.has(messageId)||this.deleted.has(messageId))return 'missing';this.deleted.add(messageId);await this.onDeleted?.(messageId);return 'deleted';}
  finally {this.deleting--;}
 }
 async lookupOutcome(_intent:IncidentIntent){await this.outside();return this.lookup;}
}


