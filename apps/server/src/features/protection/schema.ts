import {pgTable,text,uuid,integer,boolean,jsonb,bigint,primaryKey,foreignKey,index} from 'drizzle-orm/pg-core';
import type {RuleInput} from '@eousbot/contracts';
import {guilds,guildChannels} from '../../guilds/schema.js';
export const channelRules=pgTable('channel_rules',{
 guildId:text('guild_id').notNull().references(()=>guilds.id),id:uuid('id').notNull().defaultRandom(),
 channelId:text('channel_id').notNull(),revision:integer('revision').notNull().default(1),enabled:boolean('enabled').notNull(),
 config:jsonb('config').$type<RuleInput>().notNull(),deletedAt:bigint('deleted_at',{mode:'number'}),
},t=>[primaryKey({columns:[t.guildId,t.id]}),foreignKey({columns:[t.guildId,t.channelId],foreignColumns:[guildChannels.guildId,guildChannels.id]}),index('rules_channel_enabled').on(t.guildId,t.channelId,t.enabled)]);

