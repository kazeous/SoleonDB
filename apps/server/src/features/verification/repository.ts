import {eq,and} from 'drizzle-orm';
import type {VerificationConfig,Versioned} from '@eousbot/contracts';
import type {AppDb} from '../../db/client.js';
import {withTransaction} from '../../db/client.js';
import {withMemberLock,withConfigLock} from '../../db/locks.js';
import type {Clock} from '../../core/clock.js';
import {createSettingsService} from '../../guilds/settings.js';
import {verificationPanels,verificationAssignments} from './schema.js';
import {AppError} from '../../core/errors.js';
export interface VerificationBinding {guildId:string;generation:number;channelId:string;roleId:string;emojiKey:string;emojiRender:string;messageId:string|null;active:boolean;state:'creating'|'unknown'|'ready'|'missing'|'failed';operationId:string;createdAt:number;createdBy?:string|null}
export interface VerificationAssignment {guildId:string;generation:number;userId:string;roleId:string;normal:boolean;burst:boolean;roleGranted:boolean;botGranted:boolean;priorRole:boolean;retiredEligible:boolean;operation:'none'|'grant'|'remove'|'transfer_remove';transferRoleId:string|null;updatedAt:number}
export interface VerificationRepository {
 config(guildId:string):Promise<Versioned<VerificationConfig>>;
 listBindings(guildId:string):Promise<VerificationBinding[]>;
 findBinding(guildId:string,messageId:string):Promise<VerificationBinding|null>;
 reserve(guildId:string,input:Omit<VerificationBinding,'generation'|'messageId'|'active'|'state'>):Promise<{binding:VerificationBinding;fresh:boolean}>;
 activate(binding:VerificationBinding,messageId:string):Promise<VerificationBinding>;
 setBindingState(guildId:string,generation:number,state:VerificationBinding['state']):Promise<void>;
 assignments(guildId:string,userId?:string):Promise<VerificationAssignment[]>;
 saveAssignment(assignment:VerificationAssignment):Promise<void>;
}
function binding(row:typeof verificationPanels.$inferSelect):VerificationBinding {return {...row,state:row.state as VerificationBinding['state']};}
function assignment(row:typeof verificationAssignments.$inferSelect):VerificationAssignment {return {...row,operation:row.operation as VerificationAssignment['operation']};}
export function createVerificationRepository(db:AppDb,clock:Clock):VerificationRepository {
 const settings=createSettingsService(db,clock);
 return {
  config:guildId=>settings.read(guildId,'verification'),
  async listBindings(guildId){return (await db.orm.select().from(verificationPanels).where(eq(verificationPanels.guildId,guildId))).map(binding);},
  async findBinding(guildId,messageId){const row=(await db.orm.select().from(verificationPanels).where(and(eq(verificationPanels.guildId,guildId),eq(verificationPanels.messageId,messageId))))[0];return row?binding(row):null;},
  async reserve(guildId,input){return withTransaction(db,tx=>withConfigLock(tx,guildId,async()=>{
   const active=await tx.query('SELECT 1 FROM guilds WHERE id=$1 AND active AND bot_present',[guildId]);if(!active.rowCount)throw new AppError('forbidden','Activate this server before verification setup');
   const pending=(await tx.orm.select().from(verificationPanels).where(eq(verificationPanels.guildId,guildId))).find(row=>row.state==='creating'||row.state==='unknown');if(pending)return {binding:binding(pending),fresh:false};
   const generation=(await tx.query<{generation:number}>('SELECT COALESCE(MAX(generation),0)+1 AS generation FROM verification_panels WHERE guild_id=$1',[guildId])).rows[0]!.generation;
   const [row]=await tx.orm.insert(verificationPanels).values({...input,guildId,generation,active:false,state:'creating',messageId:null}).returning();return {binding:binding(row!),fresh:true};
  }));},
  async activate(value,messageId){return withTransaction(db,tx=>withConfigLock(tx,value.guildId,async()=>{
   await tx.query("UPDATE verification_assignments SET retired_eligible=(role_granted OR operation='grant') AND (normal OR burst) AND operation<>'transfer_remove' WHERE guild_id=$1 AND generation IN (SELECT generation FROM verification_panels WHERE guild_id=$1 AND active)",[value.guildId]);
   await tx.query('UPDATE verification_panels SET active=false WHERE guild_id=$1 AND active',[value.guildId]);
   const [row]=await tx.orm.update(verificationPanels).set({active:true,state:'ready',messageId}).where(and(eq(verificationPanels.guildId,value.guildId),eq(verificationPanels.generation,value.generation))).returning();
   await tx.query('INSERT INTO configuration_audit(guild_id,actor_id,feature,previous_value,new_value,created_at) VALUES($1,$2,$3,$4,$5,$6)',[value.guildId,value.createdBy??value.guildId,'verification_panel',null,{generation:value.generation,roleId:value.roleId,channelId:value.channelId,messageId},clock.now()]);return binding(row!);
  }));},
  async setBindingState(guildId,generation,state){await db.orm.update(verificationPanels).set({state}).where(and(eq(verificationPanels.guildId,guildId),eq(verificationPanels.generation,generation)));},
  async assignments(guildId,userId){const rows=await db.orm.select().from(verificationAssignments).where(userId===undefined?eq(verificationAssignments.guildId,guildId):and(eq(verificationAssignments.guildId,guildId),eq(verificationAssignments.userId,userId)));return rows.map(assignment);},
  async saveAssignment(value){await withTransaction(db,tx=>withMemberLock(tx,value.guildId,value.userId,async()=>{
   const panel=(await tx.orm.select().from(verificationPanels).where(and(eq(verificationPanels.guildId,value.guildId),eq(verificationPanels.generation,value.generation))))[0];
   if(!panel)throw new AppError('not_found','Verification generation not found');
   const existing=(await tx.orm.select().from(verificationAssignments).where(and(eq(verificationAssignments.guildId,value.guildId),eq(verificationAssignments.generation,value.generation),eq(verificationAssignments.userId,value.userId))))[0];
   const saved={...value};
   if(!panel.active){
    if(!existing)throw new AppError('conflict','Retired panels cannot start new verification');
    if(value.operation==='grant'&&!existing.retiredEligible)throw new AppError('conflict','Re-verify using the active panel');
    if(existing.retiredEligible&&value.roleGranted&&(value.normal||value.burst)&&value.operation!=='transfer_remove')saved.retiredEligible=true;
   }
   await tx.orm.insert(verificationAssignments).values(saved).onConflictDoUpdate({target:[verificationAssignments.guildId,verificationAssignments.generation,verificationAssignments.userId],set:saved});
  }));},
 };
}

