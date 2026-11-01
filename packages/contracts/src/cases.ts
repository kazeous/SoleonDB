import {autoModSnapshotSchema} from './automod.js';
import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
import {channelRuleSchema} from './channel-rules.js';
export const caseOutcomeStateSchema=z.enum(['succeeded','partial','blocked','failed','unknown','cancelled']);
export const caseOutcomeSchema=z.strictObject({state:caseOutcomeStateSchema,cleanup:z.strictObject({deleted:z.number().int().nonnegative(),missing:z.number().int().nonnegative(),failed:z.number().int().nonnegative()}),punishment:z.strictObject({state:z.enum(['pending','succeeded','blocked','failed','unknown','cancelled','not_requested']),reason:z.string().optional()}),cancellation:z.strictObject({reason:z.string()}).optional()});
export const caseSourceSchema=z.enum(['channel_rule','general_automod','command']);
export const caseActionSchema=z.enum(['warn','timeout','kick','ban','clean']);
export const caseFilterSchema=z.strictObject({memberId:snowflakeSchema.optional(),action:caseActionSchema.optional(),source:caseSourceSchema.optional(),outcome:caseOutcomeStateSchema.optional(),from:z.number().int().nonnegative().optional(),to:z.number().int().nonnegative().optional()}).refine(value=>value.from===undefined||value.to===undefined||value.from<=value.to,'Start must be before end');
export const moderationCaseSchema=z.strictObject({id:z.uuid(),guildId:snowflakeSchema,number:z.number().int().min(1),targetId:snowflakeSchema,actorId:snowflakeSchema.nullable(),source:caseSourceSchema,action:caseActionSchema.nullable(),reason:z.string(),ruleSnapshot:z.array(channelRuleSchema),policySnapshot:autoModSnapshotSchema.nullable(),createdAt:z.number().int(),durationSeconds:z.number().int().nullable(),outcome:caseOutcomeSchema.nullable()});
export const casePageSchema=z.strictObject({items:z.array(moderationCaseSchema),nextCursor:z.string().nullable()});
export type CaseFilter=z.infer<typeof caseFilterSchema>;
export type CaseOutcome=z.infer<typeof caseOutcomeSchema>;
export type ModerationCase=z.infer<typeof moderationCaseSchema>;
export type CasePage=z.infer<typeof casePageSchema>;

