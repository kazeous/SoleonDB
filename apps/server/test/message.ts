import type {MessageSnapshot} from '../src/discord/messages.js';
import {extractExplicitMentions} from '../src/discord/client.js';
export function message(overrides:Partial<MessageSnapshot>={}):MessageSnapshot {
 const content=overrides.content??'hello';
 return {id:'333333333333333333',guildId:'9223372036854775807',channelId:'111111111111111111',userId:'123456789012345678',content,mentions:extractExplicitMentions(content),attachments:[],stickerIds:[],replyToMessageId:null,isThread:false,createdAt:0,editedAt:null,authorKind:'human',partial:false,member:{roleIds:[],permissions:'0',highestRolePosition:1,displayName:'Member'},...overrides};
}

