import type {RoleRef,RolePickerInput} from '@eousbot/contracts';
export interface RolesPort {
 validateCreate(guildId:string,channelId:string,actorId:string):Promise<{name:string}>;
 role(guildId:string,roleId:string):Promise<RoleRef|null>;
 botState(guildId:string):Promise<{position:number;canManageRoles:boolean}>;
 memberRoleState(guildId:string,userId:string):Promise<{roleIds:string[];isBot:boolean}>;
 postPanel(guildId:string,channelId:string,operationId:string,input:RolePickerInput):Promise<string>;
 findPanel(guildId:string,channelId:string,operationId:string):Promise<string|null>;
 fetchPanel(guildId:string,channelId:string,messageId:string):Promise<boolean>;
 addRole(guildId:string,userId:string,roleId:string):Promise<void>;
 removeRole(guildId:string,userId:string,roleId:string):Promise<void>;
}
export class RoleEffectError extends Error {constructor(public readonly outcome:'rejected'|'unknown',message:string){super(message);}}

