import {VerificationPanelError} from './ports.js';
import {randomUUID} from 'node:crypto';
import {normalizeEmoji,snowflakeSchema} from '@eousbot/contracts';
import type {Clock} from '../../core/clock.js';
import type {FeatureStatusRegistry} from '../../core/status.js';
import {AppError} from '../../core/errors.js';
import type {VerificationRepository,VerificationBinding,VerificationAssignment} from './repository.js';
import type {VerificationPort,ReactionEvent,ReconcileResult} from './ports.js';
import {enumerateReactions} from './reconcile.js';
import type {ReactionSnapshot} from './reconcile.js';
interface Deps {repository:VerificationRepository;port:VerificationPort;clock:Clock;status:FeatureStatusRegistry}
const result=():ReconcileResult=>({added:0,removed:0,preserved:0,failed:0,complete:true});
export function createVerificationService({repository,port,clock,status}:Deps) {
 const users=new Map<string,Promise<unknown>>(),reconciles=new Map<string,Promise<ReconcileResult>>(),events=new Map<string,number>(),bulkEvents=new Map<string,number>();let sequence=0,pendingEvents=0;
 function clearEventHistory(){if(pendingEvents===0&&users.size===0&&reconciles.size===0){events.clear();bulkEvents.clear();}}
 function degraded(guildId:string,reason:string){status.set(guildId,'verification','degraded',reason);}
 function withUser<T>(guildId:string,userId:string,run:()=>Promise<T>):Promise<T>{const key=guildId+':'+userId;const pending=(users.get(key)??Promise.resolve()).catch(()=>undefined).then(run).finally(()=>{if(users.get(key)===pending)users.delete(key);clearEventHistory();});users.set(key,pending);return pending;}
 async function panelValid(binding:VerificationBinding):Promise<boolean>{
  try {if(await port.fetchPanel(binding)==='valid'){if(binding.state==='missing')await repository.setBindingState(binding.guildId,binding.generation,'ready');binding.state='ready';return true;}}
  catch {/* An unavailable panel never establishes that reactions are absent. */}
  await repository.setBindingState(binding.guildId,binding.generation,'missing');binding.state='missing';degraded(binding.guildId,'Verification panel is missing or unavailable. Existing roles were preserved; repair the panel.');return false;
 }
 function newAssignment(binding:VerificationBinding,userId:string,roles:Set<string>,others:VerificationAssignment[]):VerificationAssignment {
  const owned=others.some(row=>row.roleId===binding.roleId&&row.roleGranted&&row.botGranted);
  return {guildId:binding.guildId,generation:binding.generation,userId,roleId:binding.roleId,normal:false,burst:false,roleGranted:false,botGranted:owned,priorRole:roles.has(binding.roleId)&&!owned,retiredEligible:false,operation:'grant',transferRoleId:null,updatedAt:clock.now()};
 }
 async function save(row:VerificationAssignment){row.updatedAt=clock.now();await repository.saveAssignment(row);}
 async function syncUser(guildId:string,userId:string,proven:Set<number>,allowRemoval:boolean):Promise<ReconcileResult>{
  const stats=result(),bindings=await repository.listBindings(guildId),byGeneration=new Map(bindings.map(binding=>[binding.generation,binding])),rows=await repository.assignments(guildId,userId),member=await port.memberRoleState(guildId,userId);
  if(member.isBot||!member.present){stats.preserved=rows.filter(row=>row.roleGranted).length;return stats;}
  const roles=new Set(member.roleIds),failedGrants=new Set<string>();
  async function grant(row:VerificationAssignment):Promise<boolean>{
   try {
    if(!roles.has(row.roleId)){row.operation='grant';await save(row);await port.addRole(guildId,userId,row.roleId);roles.add(row.roleId);stats.added++;}
    row.roleGranted=true;row.botGranted=!row.priorRole||rows.some(other=>other!==row&&other.roleId===row.roleId&&other.botGranted&&other.roleGranted);row.operation='none';await save(row);return true;
   }catch {failedGrants.add(row.roleId);stats.failed++;stats.complete=false;degraded(guildId,'A verification role could not be granted. Existing access was preserved; retry is pending.');return false;}
  }
  const active=bindings.find(binding=>binding.active&&binding.state==='ready'),current=active?rows.find(row=>row.generation===active.generation):undefined;
  if(current&&(current.normal||current.burst)&&await grant(current)){
   for(const old of rows.filter(row=>row.roleId!==current.roleId&&row.roleGranted&&row.botGranted)){
    const manual=rows.some(other=>other.roleId===old.roleId&&other.roleGranted&&other.priorRole&&!other.botGranted);
    if(manual)continue;old.operation='transfer_remove';old.transferRoleId=current.roleId;await save(old);
   }
  }
  for(const roleId of new Set(rows.map(row=>row.roleId))){
   const group=rows.filter(row=>row.roleId===roleId),transfer=group.find(row=>row.roleGranted&&row.botGranted&&row.operation==='transfer_remove');
   const wanted=group.find(row=>{const binding=byGeneration.get(row.generation);return row.operation!=='transfer_remove'&&(row.normal||row.burst)&&binding?.state==='ready'&&(binding.active||row.retiredEligible);});
   if(!transfer&&wanted){if(!failedGrants.has(roleId)&&wanted!==current)await grant(wanted);stats.preserved++;continue;}
   const unknown=group.some(row=>row.roleGranted&&byGeneration.get(row.generation)?.state!=='ready');
   const manualOnly=group.some(row=>row.roleGranted&&row.priorRole&&!row.botGranted)&&!group.some(row=>row.roleGranted&&byGeneration.get(row.generation)?.active);
   const authorized=transfer?!!transfer.transferRoleId&&roles.has(transfer.transferRoleId):!unknown&&group.filter(row=>row.roleGranted).every(row=>proven.has(row.generation)||row.operation==='remove');
   const managed=group.filter(row=>row.roleGranted&&(row.botGranted||byGeneration.get(row.generation)?.active));
   if(!allowRemoval||!authorized||manualOnly||!managed.length){stats.preserved+=group.some(row=>row.roleGranted)?1:0;continue;}
   try {
    for(const row of managed){if(row.operation!=='transfer_remove')row.operation='remove';await save(row);}
    if(roles.has(roleId)){await port.removeRole(guildId,userId,roleId);roles.delete(roleId);stats.removed++;}
    for(const row of group){row.roleGranted=false;row.retiredEligible=false;row.operation='none';row.transferRoleId=null;await save(row);}
   }catch {stats.failed++;stats.complete=false;degraded(guildId,'A verification role removal is pending. A successful new role grant was retained.');}
  }
  return stats;
 }
 async function observeSnapshot(binding:VerificationBinding,userId:string,snapshot:ReactionSnapshot):Promise<void>{
  const rows=await repository.assignments(binding.guildId,userId);let row=rows.find(item=>item.generation===binding.generation);
  const normal=snapshot.normal.has(userId),burst=snapshot.burst.has(userId);
  if(!row){if(!binding.active||!normal&&!burst)return;const member=await port.memberRoleState(binding.guildId,userId);if(member.isBot||!member.present)return;row=newAssignment(binding,userId,new Set(member.roleIds),rows);}
  if(!binding.active&&!row.retiredEligible){if(!normal&&!burst){row.normal=false;row.burst=false;await save(row);}return;}
  row.normal=normal;row.burst=burst;if(!binding.active&&!normal&&!burst)row.retiredEligible=false;await save(row);
 }
 async function changed(event:ReactionEvent,eventSequence:number):Promise<void>{
  const config=await repository.config(event.guildId);if(!config.value.enabled){status.set(event.guildId,'verification','disabled');return;}
  const binding=await repository.findBinding(event.guildId,event.messageId);if(!binding||binding.channelId!==event.channelId)return;
  if(event.kind!=='remove_all'&&event.emojiKey!==binding.emojiKey)return;
  if(event.kind==='remove_all'||event.kind==='remove_emoji'){await reconcile(event.guildId);return;}
  await withUser(event.guildId,event.userId,async()=>{
   const binding=await repository.findBinding(event.guildId,event.messageId);if(!binding)return;
   if(!await panelValid(binding))return;
   const member=await port.memberRoleState(event.guildId,event.userId);if(member.isBot||!member.present)return;
   const rows=await repository.assignments(event.guildId,event.userId);let row=rows.find(item=>item.generation===binding.generation);
   if(event.kind==='add'){
    if(!binding.active&&(!row?.retiredEligible||!row.roleGranted||row.operation==='transfer_remove'||!row.normal&&!row.burst))return;
    row??=newAssignment(binding,event.userId,new Set(member.roleIds),rows);row[event.reactionType]=true;if(row.operation==='remove')row.operation='none';await save(row);await syncUser(event.guildId,event.userId,new Set([binding.generation]),true);return;
   }
   if(!row)return;
   // Obtain complete normal/burst results for every tracked same-role panel before revocation.
   const relevant=(await repository.listBindings(event.guildId)).filter(item=>item.roleId===binding.roleId&&item.messageId&&(item.active||rows.some(row=>row.generation===item.generation&&row.roleGranted)));
   const snapshots:Array<{binding:VerificationBinding;value:ReactionSnapshot}>=[];
   for(const item of relevant){if(!await panelValid(item))return;try{snapshots.push({binding:item,value:await enumerateReactions(port,item)});}catch{degraded(event.guildId,'Reaction enumeration was incomplete. Roles were preserved and reconciliation will retry.');return;}}
   if((events.get(event.guildId+':'+event.userId)??0)!==eventSequence)return;
   for(const snapshot of snapshots)await observeSnapshot(snapshot.binding,event.userId,snapshot.value);
   await syncUser(event.guildId,event.userId,new Set(snapshots.map(item=>item.binding.generation)),true);
  });
 }
 async function performReconcile(guildId:string):Promise<ReconcileResult>{
  const stats=result(),config=await repository.config(guildId);if(!config.value.enabled){status.set(guildId,'verification','disabled');return stats;}
  const start=sequence,all=await repository.assignments(guildId),bindings=(await repository.listBindings(guildId)).filter(binding=>binding.messageId&&(binding.active||all.some(row=>row.generation===binding.generation&&(row.roleGranted||row.operation!=='none'))));
  if(!bindings.length){status.set(guildId,'verification','needs_setup','Save settings, then run /verifysetup to post a verification panel.');stats.complete=false;return stats;}
  const snapshots:Array<{binding:VerificationBinding;value:ReactionSnapshot;bulkSequence:number}>=[];
  for(const binding of bindings){const bulkSequence=bulkEvents.get(guildId+':'+binding.messageId)??0;if(!await panelValid(binding)){stats.complete=false;stats.preserved++;continue;}try{snapshots.push({binding,value:await enumerateReactions(port,binding),bulkSequence});}catch{stats.complete=false;stats.preserved++;degraded(guildId,'Reaction enumeration was incomplete. No roles will be removed until complete results are available.');}}
  if(snapshots.some(item=>(bulkEvents.get(guildId+':'+item.binding.messageId)??0)!==item.bulkSequence)){stats.complete=false;return stats;}
  const ids=new Set(all.map(row=>row.userId));for(const snapshot of snapshots)if(snapshot.binding.active)for(const id of [...snapshot.value.normal,...snapshot.value.burst])ids.add(id);
  const list=[...ids],proven=new Set(snapshots.map(item=>item.binding.generation));
  for(let offset=0;offset<list.length;offset+=25){
   const batch=await Promise.all(list.slice(offset,offset+25).map(userId=>withUser(guildId,userId,async()=>{
    const local=result();if((events.get(guildId+':'+userId)??0)>start){local.complete=false;local.preserved++;return local;}
    try{for(const snapshot of snapshots)await observeSnapshot(snapshot.binding,userId,snapshot.value);return await syncUser(guildId,userId,proven,stats.complete);}catch{local.failed++;local.complete=false;degraded(guildId,'Verification reconciliation encountered an unavailable member or storage operation.');return local;}
   })));
   for(const local of batch){stats.added+=local.added;stats.removed+=local.removed;stats.preserved+=local.preserved;stats.failed+=local.failed;if(!local.complete)stats.complete=false;}
  }
  if(stats.complete&&stats.failed===0)status.set(guildId,'verification','ready');return stats;
 }
 function reconcile(guildId:string):Promise<ReconcileResult>{const existing=reconciles.get(guildId);if(existing)return existing;const pending=performReconcile(guildId).finally(()=>{reconciles.delete(guildId);clearEventHistory();});reconciles.set(guildId,pending);return pending;}
 return {
  async setup(guildId:string,channelId:string,actorId:string):Promise<{messageId:string;generation:number}>{
   const config=(await repository.config(guildId)).value;if(!config.enabled||!config.roleId||!config.channelId||config.channelId!==channelId)throw new AppError('validation','Save a complete verification channel, emoji and role before running /verifysetup');
   const emoji=normalizeEmoji(config.emoji);await port.validateSetup(guildId,channelId,config.roleId,emoji.render,actorId);
   const reserved=await repository.reserve(guildId,{guildId,channelId,roleId:config.roleId,emojiKey:emoji.key,emojiRender:emoji.render,operationId:randomUUID(),createdAt:clock.now(),createdBy:actorId});
   const binding=reserved.binding;let messageId:string|null=null,sendAttempted=false;
   try {
    await port.validateSetup(guildId,binding.channelId,binding.roleId,binding.emojiRender,actorId);
    if(reserved.fresh){sendAttempted=true;messageId=await port.postPanel(binding,config.prompt);}else messageId=await port.findPanel(binding);
    if(!messageId)throw new AppError('conflict','Panel send outcome is unknown. Check the existing panel before retrying; no duplicate was posted.');
    const active=await repository.activate(binding,snowflakeSchema.parse(messageId));
    try{await port.ensurePanelReaction(active);}catch{degraded(guildId,'Panel was registered but its example reaction could not be added. Check reaction permissions.');}
    return {messageId,generation:active.generation};
   }catch(error){const notSent=reserved.fresh&&(!sendAttempted||error instanceof VerificationPanelError&&error.outcome==='not_sent');await repository.setBindingState(guildId,binding.generation,notSent?'failed':'unknown');if(notSent)status.set(guildId,'verification','needs_setup','Panel was not sent. Repair permissions and run /verifysetup again.');else degraded(guildId,'Verification panel creation needs reconciliation. Existing roles and panel were preserved.');throw error instanceof AppError?error:new AppError('unavailable',notSent?'Panel was not sent. Repair setup and retry.':'Panel creation outcome could not be confirmed. Retry reconciles the existing operation.');}
  },
  async reactionChanged(event:ReactionEvent):Promise<void>{
   pendingEvents++;const current=++sequence;if(event.kind==='add'||event.kind==='remove')events.set(event.guildId+':'+event.userId,current);else bulkEvents.set(event.guildId+':'+event.messageId,current);
   try{await changed(event,current);}catch{degraded(event.guildId,'Verification update is pending after a role or storage failure. Existing access was preserved.');}finally{pendingEvents--;clearEventHistory();}
  },
  reconcile,
 };
}
export type VerificationService=ReturnType<typeof createVerificationService>;
