import type {VerificationRepository,VerificationBinding,VerificationAssignment} from '../src/features/verification/repository.js';
import type {VerificationPort,ReactionEvent} from '../src/features/verification/ports.js';
import type {VerificationConfig} from '@eousbot/contracts';
export const verificationGuild='9223372036854775807',verificationChannel='111111111111111111',verificationRole='222222222222222222',verificationUser='123456789012345678',verificationMessage='333333333333333333';
export class MemoryVerificationRepository implements VerificationRepository {
 settings:VerificationConfig={enabled:true,channelId:verificationChannel,roleId:verificationRole,emoji:'✅',prompt:'React to verify.'};
 bindings:VerificationBinding[]=[{guildId:verificationGuild,generation:1,channelId:verificationChannel,roleId:verificationRole,emojiKey:'unicode:✅',emojiRender:'✅',messageId:verificationMessage,active:true,state:'ready',operationId:'74cc420d-32d0-4b3b-8d55-6adc52bd8026',createdAt:0}];
 rows:VerificationAssignment[]=[];
 async config(){return {revision:1,value:structuredClone(this.settings)};}
 async listBindings(guildId:string){return structuredClone(this.bindings.filter(b=>b.guildId===guildId));}
 async findBinding(guildId:string,messageId:string){return (await this.listBindings(guildId)).find(b=>b.messageId===messageId)??null;}
 async reserve(guildId:string,input:Omit<VerificationBinding,'generation'|'messageId'|'active'|'state'>){const pending=this.bindings.find(b=>b.guildId===guildId&&['creating','unknown'].includes(b.state));if(pending)return {binding:structuredClone(pending),fresh:false};const binding:VerificationBinding={...input,guildId,generation:Math.max(0,...this.bindings.filter(b=>b.guildId===guildId).map(b=>b.generation))+1,messageId:null,active:false,state:'creating'};this.bindings.push(binding);return {binding:structuredClone(binding),fresh:true};}
 async activate(binding:VerificationBinding,messageId:string){for(const existing of this.bindings.filter(b=>b.guildId===binding.guildId)){if(existing.active){existing.active=false;for(const a of this.rows.filter(a=>a.guildId===existing.guildId&&a.generation===existing.generation))a.retiredEligible=a.roleGranted&&(a.normal||a.burst)&&a.operation!=='transfer_remove';}}const actual=this.bindings.find(b=>b.guildId===binding.guildId&&b.generation===binding.generation)!;actual.active=true;actual.state='ready';actual.messageId=messageId;return structuredClone(actual);}
 async setBindingState(guildId:string,generation:number,state:VerificationBinding['state']){this.bindings.find(b=>b.guildId===guildId&&b.generation===generation)!.state=state;}
 async assignments(guildId:string,userId?:string){return structuredClone(this.rows.filter(a=>a.guildId===guildId&&(userId===undefined||a.userId===userId)));}
 async saveAssignment(value:VerificationAssignment){const index=this.rows.findIndex(a=>a.guildId===value.guildId&&a.userId===value.userId&&a.generation===value.generation);if(index<0)this.rows.push(structuredClone(value));else this.rows[index]=structuredClone(value);}
}
export class FakeVerificationPort implements VerificationPort {
 roles=new Map<string,Set<string>>();reactors=new Map<string,Set<string>>();bots=new Set<string>();missing=new Set<string>();effects:Array<{kind:string;guildId:string;userId:string;roleId:string}>=[];
 posts=0;throwAfterSend=false;denyRole=false;failGrant=false;failRemove=false;failPage:string|null=null;accepted=new Map<string,string>();
 key(binding:VerificationBinding,type:'normal'|'burst'){return binding.guildId+':'+binding.generation+':'+type;}
 async validateSetup(){if(this.denyRole)throw new Error('Role is privileged or unmanageable');}
 async fetchPanel(binding:VerificationBinding){return this.missing.has(binding.messageId??'')?'missing' as const:'valid' as const;}
 async postPanel(binding:VerificationBinding,_prompt:string){this.posts++;const id=String(1000000000000000000n+BigInt(this.posts));this.accepted.set(binding.operationId,id);if(this.throwAfterSend)throw new Error('Unknown send outcome');return id;}
 async findPanel(binding:VerificationBinding){return this.accepted.get(binding.operationId)??null;}
 async ensurePanelReaction(){}
 async listReactors(binding:VerificationBinding,type:'normal'|'burst',cursor:string|null){if(cursor!==null&&this.failPage===type)throw new Error('Second page unavailable');const users=[...(this.reactors.get(this.key(binding,type))??[])].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1).filter(id=>cursor===null||BigInt(id)>BigInt(cursor));const page=users.slice(0,100);return {userIds:page,nextCursor:users.length>100?page.at(-1)!:null};}
 async memberRoleState(guildId:string,userId:string){return {roleIds:[...(this.roles.get(guildId+':'+userId)??[])],isBot:this.bots.has(userId),present:true};}
 async addRole(guildId:string,userId:string,roleId:string){if(this.failGrant||this.denyRole)throw new Error('Cannot grant role');const roles=this.roles.get(guildId+':'+userId)??new Set<string>();roles.add(roleId);this.roles.set(guildId+':'+userId,roles);this.effects.push({kind:'add',guildId,userId,roleId});}
 async removeRole(guildId:string,userId:string,roleId:string){if(this.failRemove)throw new Error('Cannot remove role');this.roles.get(guildId+':'+userId)?.delete(roleId);this.effects.push({kind:'remove',guildId,userId,roleId});}
 observe(binding:VerificationBinding,event:ReactionEvent){if(event.kind!=='add'&&event.kind!=='remove')return;const key=this.key(binding,event.reactionType),users=this.reactors.get(key)??new Set<string>();if(event.kind==='add')users.add(event.userId);else users.delete(event.userId);this.reactors.set(key,users);}
}
export function reaction(kind:'add'|'remove',reactionType:'normal'|'burst'='normal'):ReactionEvent{return {kind,reactionType,guildId:verificationGuild,channelId:verificationChannel,messageId:verificationMessage,userId:verificationUser,emojiKey:'unicode:✅'};}
