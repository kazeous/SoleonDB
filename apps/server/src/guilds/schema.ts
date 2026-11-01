import { sql } from 'drizzle-orm';
import {pgTable,text,boolean,integer,bigint,jsonb,uuid,primaryKey,foreignKey,index,check} from 'drizzle-orm/pg-core';
export const guilds=pgTable('guilds',{
  id:text('id').primaryKey(), name:text('name').notNull().default(''),
  iconUrl:text('icon_url'),active:boolean('active').notNull().default(false),
  botPresent:boolean('bot_present').notNull().default(true),
});
export const guildChannels=pgTable('guild_channels',{
  guildId:text('guild_id').notNull().references(()=>guilds.id),id:text('id').notNull(),
  name:text('name').notNull(),type:text('type').notNull(),
},t=>[primaryKey({columns:[t.guildId,t.id]})]);
export const featureSettings=pgTable('feature_settings',{
  guildId:text('guild_id').notNull().references(()=>guilds.id),feature:text('feature').notNull(),
  revision:integer('revision').notNull().default(1),value:jsonb('value').notNull(),
  logChannelId:text('log_channel_id'),
},t=>[
  primaryKey({columns:[t.guildId,t.feature]}),
  foreignKey({columns:[t.guildId,t.logChannelId],foreignColumns:[guildChannels.guildId,guildChannels.id]}),
  check('settings_revision_positive',sql.raw('revision > 0')),
]);
export const configurationAudit=pgTable('configuration_audit',{
  id:uuid('id').primaryKey().defaultRandom(),guildId:text('guild_id').notNull().references(()=>guilds.id),
  actorId:text('actor_id').notNull(),feature:text('feature').notNull(),
  previousValue:jsonb('previous_value'),newValue:jsonb('new_value').notNull(),
  createdAt:bigint('created_at',{mode:'number'}).notNull(),
},t=>[index('audit_guild_time').on(t.guildId,t.createdAt,t.id)]);

