import type {GuildSummary,ChannelRef,RoleRef,MemberRef} from '@eousbot/contracts';
export interface GuildDirectory {
  list(ownerId:string):Promise<GuildSummary[]>;
  access(ownerId:string,guildId:string):Promise<'owner'|'manage_guild'|'none'>;
  channels(guildId:string):Promise<ChannelRef[]>;
  roles(guildId:string):Promise<RoleRef[]>;
  members(guildId:string,query:string,limit:number):Promise<MemberRef[]>;
}

