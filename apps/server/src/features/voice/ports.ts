import type {RoleRef,VoiceAction} from '@eousbot/contracts';
export interface VoiceMember{id:string;guildId:string;isBot:boolean;displayName:string;voiceChannelId:string|null;permissions:string;game:string|null}
export interface VoiceRoom{guildId:string;channelId:string;parentId:string|null;memberIds:string[];maxBitrate:number;regions:string[];textEnabled:boolean;nsfw:boolean}
export type VoiceProperties={name?:string;limit?:number;status?:string;bitrate?:number;region?:string|null;nsfw?:boolean};
export type VoiceOverwrite={kind:'lock'|'unlock'|'hide'|'unhide'}|{kind:'text';enabled:boolean}|{kind:'allow-user'|'deny-user'|'allow-role'|'deny-role';id:string}|{kind:'inherit'}|{kind:'transfer';oldOwnerId:string;newOwnerId:string};
export interface VoicePort{
 hub(guildId:string,channelId:string):Promise<{name:string;parentId:string|null}>;
 member(guildId:string,userId:string):Promise<VoiceMember|null>;role(guildId:string,roleId:string):Promise<RoleRef|null>;
 createRoom(guildId:string,hubId:string,ownerId:string,name:string,operationId:string):Promise<string>;
 findCreatedRoom(guildId:string,hubId:string,operationId:string):Promise<string|null>;
 move(guildId:string,userId:string,channelId:string):Promise<void>;
 getRoom(guildId:string,channelId:string):Promise<VoiceRoom|null>;
 deleteRoom(guildId:string,channelId:string):Promise<boolean>;
 panelExists(guildId:string,channelId:string,messageId:string):Promise<boolean>;
 findPanel(guildId:string,channelId:string,operationId:string):Promise<string|null>;
 postOrEditPanel(guildId:string,channelId:string,ownerId:string,messageId:string|null,operationId:string):Promise<string>;
 setProperties(guildId:string,channelId:string,properties:VoiceProperties):Promise<void>;
 setOverwrites(guildId:string,channelId:string,ownerId:string,action:VoiceOverwrite):Promise<void>;
 invite(guildId:string,channelId:string,userId:string):Promise<{delivered:boolean;url:string}>;
}
