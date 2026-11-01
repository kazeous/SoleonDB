import {pgTable,text,integer,bigint,primaryKey,index} from 'drizzle-orm/pg-core';
import {guilds} from '../../guilds/schema.js';
export const automodMessages=pgTable('automod_messages',{
 guildId:text('guild_id').notNull().references(()=>guilds.id),revision:integer('revision').notNull(),messageId:text('message_id').notNull(),userId:text('user_id').notNull(),channelId:text('channel_id').notNull(),
 observedAt:bigint('observed_at',{mode:'number'}).notNull(),violationAt:bigint('violation_at',{mode:'number'}),consumedAt:bigint('consumed_at',{mode:'number'}),expiresAt:bigint('expires_at',{mode:'number'}).notNull(),
},t=>[primaryKey({columns:[t.guildId,t.revision,t.messageId]}),index('automod_member_window').on(t.guildId,t.revision,t.userId,t.observedAt),index('automod_expiry').on(t.expiresAt)]);

