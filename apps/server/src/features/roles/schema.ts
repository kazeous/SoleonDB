import {pgTable,text,uuid,integer,bigint,boolean,primaryKey,foreignKey,unique,index} from 'drizzle-orm/pg-core';
import {guilds,guildChannels} from '../../guilds/schema.js';
export const rolePickerPanels=pgTable('role_picker_panels',{
 guildId:text('guild_id').notNull().references(()=>guilds.id),id:uuid('id').notNull(),channelId:text('channel_id').notNull(),messageId:text('message_id'),operationKey:text('operation_key').notNull(),title:text('title').notNull(),description:text('description').notNull(),state:text('state').notNull(),createdBy:text('created_by').notNull(),createdAt:bigint('created_at',{mode:'number'}).notNull(),
},t=>[primaryKey({columns:[t.guildId,t.id]}),unique('role_panel_message').on(t.guildId,t.messageId),unique('role_panel_operation').on(t.guildId,t.operationKey),foreignKey({columns:[t.guildId,t.channelId],foreignColumns:[guildChannels.guildId,guildChannels.id]})]);
export const rolePickerOptions=pgTable('role_picker_options',{
 guildId:text('guild_id').notNull(),panelId:uuid('panel_id').notNull(),roleId:text('role_id').notNull(),label:text('label').notNull(),emoji:text('emoji'),position:integer('position').notNull(),
},t=>[primaryKey({columns:[t.guildId,t.panelId,t.roleId]}),foreignKey({columns:[t.guildId,t.panelId],foreignColumns:[rolePickerPanels.guildId,rolePickerPanels.id]}),index('role_picker_role_bindings').on(t.guildId,t.roleId)]);
export const rolePickerOperations=pgTable('role_picker_operations',{
 guildId:text('guild_id').notNull(),id:text('id').notNull(),panelId:uuid('panel_id').notNull(),roleId:text('role_id').notNull(),userId:text('user_id').notNull(),desired:boolean('desired').notNull(),state:text('state').notNull(),createdAt:bigint('created_at',{mode:'number'}).notNull(),completedAt:bigint('completed_at',{mode:'number'}),
},t=>[primaryKey({columns:[t.guildId,t.id]}),foreignKey({columns:[t.guildId,t.panelId,t.roleId],foreignColumns:[rolePickerOptions.guildId,rolePickerOptions.panelId,rolePickerOptions.roleId]}),index('role_picker_member_operations').on(t.guildId,t.userId,t.roleId,t.state)]);

