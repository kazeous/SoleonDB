import { z } from 'zod';
import { snowflakeSchema } from './ids.js';
export const guildSummarySchema = z.strictObject({id:snowflakeSchema,name:z.string(),iconUrl:z.string().nullable(),active:z.boolean(),eligible:z.boolean(),eligibilityUnavailable:z.boolean().optional()});
export const channelRefSchema = z.strictObject({id:snowflakeSchema,guildId:snowflakeSchema,name:z.string(),type:z.enum(['text','voice','category','thread'])});
export const roleRefSchema = z.strictObject({id:snowflakeSchema,guildId:snowflakeSchema,name:z.string(),position:z.number().int(),managed:z.boolean(),permissions:z.string().regex(/^[0-9]+$/)});
export const memberRefSchema = z.strictObject({id:snowflakeSchema,guildId:snowflakeSchema,displayName:z.string(),roleIds:z.array(snowflakeSchema),permissions:z.string().regex(/^[0-9]+$/)});
export type GuildSummary = z.infer<typeof guildSummarySchema>;
export type ChannelRef = z.infer<typeof channelRefSchema>;
export type RoleRef = z.infer<typeof roleRefSchema>;
export type MemberRef = z.infer<typeof memberRefSchema>;


