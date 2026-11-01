import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
export const moderationConfigSchema=z.strictObject({enabled:z.boolean(),logChannelId:snowflakeSchema.nullable()});
export const moderationCommandSchema=z.enum(['warn','timeout','kick','ban','cases','clean']);
export type ModerationCommand=z.infer<typeof moderationCommandSchema>;
export const cleanOptionsSchema=z.strictObject({amount:z.number().int().min(1).max(100),filter:z.enum(['all','only-bots','only-users','contain-links','contain-invites','text-only']).default('all'),userId:snowflakeSchema.optional()});
export type CleanOptions=z.input<typeof cleanOptionsSchema>;
export const reasonSchema=z.string().trim().min(1).max(512).default('No reason provided.');

