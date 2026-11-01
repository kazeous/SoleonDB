export interface MessageDisposition {kind:'allow'|'held'|'delete';incidentId?:string}
export interface MessageSnapshot {
  id:string;guildId:string;channelId:string;userId:string;content:string;
  mentions:{userIds:string[];roleIds:string[];everyone:boolean;replyAuthorId?:string};
  attachments:Array<{id:string;contentType:string|null;name:string|null}>;
  stickerIds:string[];replyToMessageId:string|null;isThread:boolean;
  createdAt:number;editedAt:number|null;authorKind:'human'|'bot'|'webhook';partial:boolean;
  member:{roleIds:string[];permissions:string;highestRolePosition:number;displayName:string};
}
export type MessageStage=(message:MessageSnapshot,disposition?:MessageDisposition)=>Promise<MessageDisposition>;
export function createMessagePipeline(stages:MessageStage[]) {
  return async(message:MessageSnapshot):Promise<MessageDisposition>=>{
    let disposition:MessageDisposition={kind:'allow'};
    for(const stage of stages){const next=await stage(message,disposition);if(next.kind==='delete')return next;if(next.kind==='held'||disposition.kind!=='held')disposition=next;}
    return disposition;
  };
}

