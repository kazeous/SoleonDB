import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
export const ruleActionSchema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('timeout'),durationSeconds:z.number().int().min(60).max(2419200)}),
 z.strictObject({kind:z.literal('kick')}),z.strictObject({kind:z.literal('ban')}),
]);
export const ruleTriggerSchema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('any')}),z.strictObject({kind:z.literal('link')}),z.strictObject({kind:z.literal('photo')}),
 z.strictObject({kind:z.literal('mention'),users:z.boolean(),roles:z.boolean(),everyone:z.boolean()}).refine(v=>v.users||v.roles||v.everyone,'Choose at least one mention category'),
]);
const exemptions=z.array(snowflakeSchema).max(100).refine(values=>new Set(values).size===values.length,'Remove duplicate exemptions');
export const ruleInputSchema=z.strictObject({
 name:z.string().trim().min(1).max(60),channelId:snowflakeSchema,enabled:z.boolean(),trigger:ruleTriggerSchema,
 threshold:z.strictObject({count:z.number().int().min(1).max(100),windowSeconds:z.number().int().min(1).max(3600)}),
 action:ruleActionSchema,exemptUserIds:exemptions,exemptRoleIds:exemptions,
});
export const channelRuleSchema=ruleInputSchema.extend({id:z.uuid(),guildId:snowflakeSchema,revision:z.number().int().min(1)});
export const channelRuleResponseSchema=channelRuleSchema.extend({overridesGeneralAutoMod:z.boolean()});
export type RuleInput=z.infer<typeof ruleInputSchema>;
export type ChannelRule=z.infer<typeof channelRuleSchema>;
export type RuleAction=z.infer<typeof ruleActionSchema>;
export type RuleTrigger=z.infer<typeof ruleTriggerSchema>;

