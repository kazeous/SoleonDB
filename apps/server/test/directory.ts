import type {GuildDirectory} from '../src/guilds/ports.js';
import type {GuildSummary,ChannelRef,RoleRef,MemberRef} from '@eousbot/contracts';
import {AppError} from '../src/core/errors.js';
export const guildA='9223372036854775807',guildB='9223372036854775808',ownerId='123456789012345678';
export class FakeDirectory implements GuildDirectory {
  unavailable=false;
  guilds:GuildSummary[]=[guildA,guildB].map((id,i)=>({id,name:'Server '+(i+1),iconUrl:null,active:false,eligible:true}));
  channelData:ChannelRef[]=[{id:'111111111111111111',guildId:guildA,name:'general',type:'text'},{id:'222222222222222222',guildId:guildB,name:'other',type:'text'}];
  roleData:RoleRef[]=[];memberData:MemberRef[]=[];
  accessMode:'owner'|'manage_guild'|'none'='owner';
  check(){if(this.unavailable) throw new AppError('unavailable','Discord unavailable');}
  async list(){this.check();return this.guilds;}
  async access(_owner:string,guild:string){this.check();return this.guilds.some(g=>g.id===guild)?this.accessMode:'none';}
  async channels(guild:string){this.check();return this.channelData.filter(c=>c.guildId===guild);}
  async roles(guild:string){this.check();return this.roleData.filter(c=>c.guildId===guild);}
  async members(guild:string,query:string,limit:number){this.check();return this.memberData.filter(c=>c.guildId===guild&&c.displayName.includes(query)).slice(0,limit);}
}

