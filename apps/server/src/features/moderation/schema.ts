import {pgTable,text,uuid,integer,bigint,jsonb,primaryKey,foreignKey,index,unique} from 'drizzle-orm/pg-core';
import {guilds} from '../../guilds/schema.js';
import type {IncidentIntent,CaseOutcome} from './incidents.js';
export const moderationIncidents=pgTable('moderation_incidents',{
 guildId:text('guild_id').notNull().references(()=>guilds.id),id:uuid('id').notNull(),userId:text('user_id').notNull(),source:text('source').notNull(),
 intent:jsonb('intent').$type<IncidentIntent>().notNull(),state:text('state').notNull().default('pending'),workerId:text('worker_id'),dispatchToken:uuid('dispatch_token'),leaseUntil:bigint('lease_until',{mode:'number'}),createdAt:bigint('created_at',{mode:'number'}).notNull(),
},t=>[primaryKey({columns:[t.guildId,t.id]}),unique('incident_global_identity').on(t.id),index('incident_queue').on(t.state,t.createdAt,t.id),index('incidents_member').on(t.guildId,t.userId,t.createdAt)]);
export const memberCooldowns=pgTable('member_cooldowns',{
 guildId:text('guild_id').notNull(),userId:text('user_id').notNull(),until:bigint('until',{mode:'number'}).notNull(),parentIncidentId:uuid('parent_incident_id').notNull(),
},t=>[primaryKey({columns:[t.guildId,t.userId]}),foreignKey({columns:[t.guildId,t.parentIncidentId],foreignColumns:[moderationIncidents.guildId,moderationIncidents.id]})]);
export const guildCaseCounters=pgTable('guild_case_counters',{
 guildId:text('guild_id').primaryKey().references(()=>guilds.id),nextNumber:integer('next_number').notNull(),
});
export const moderationCases=pgTable('moderation_cases',{
 guildId:text('guild_id').notNull(),id:uuid('id').notNull(),number:integer('number').notNull(),targetId:text('target_id').notNull(),actorId:text('actor_id'),
 source:text('source').notNull(),action:text('action'),reason:text('reason').notNull(),ruleSnapshot:jsonb('rule_snapshot').notNull(),
 createdAt:bigint('created_at',{mode:'number'}).notNull(),outcome:jsonb('outcome').$type<CaseOutcome>(),
},t=>[primaryKey({columns:[t.guildId,t.id]}),unique('case_guild_number').on(t.guildId,t.number),foreignKey({columns:[t.guildId,t.id],foreignColumns:[moderationIncidents.guildId,moderationIncidents.id]}),index('cases_cursor').on(t.guildId,t.createdAt,t.id),index('cases_member').on(t.guildId,t.targetId,t.createdAt)]);


export const incidentEffects=pgTable('incident_effects',{
 guildId:text('guild_id').notNull(),incidentId:uuid('incident_id').notNull(),effectKey:text('effect_key').notNull(),kind:text('kind').notNull(),
 channelId:text('channel_id'),messageId:text('message_id'),state:text('state').notNull().default('pending'),reason:text('reason'),request:jsonb('request').$type<{until?:number;skip?:boolean;blockedReason?:string}>(),
 authorizedAt:bigint('authorized_at',{mode:'number'}),completedAt:bigint('completed_at',{mode:'number'}),
},t=>[primaryKey({columns:[t.guildId,t.incidentId,t.effectKey]}),foreignKey({columns:[t.guildId,t.incidentId],foreignColumns:[moderationIncidents.guildId,moderationIncidents.id]}),index('effects_incident_state').on(t.guildId,t.incidentId,t.state)]);
