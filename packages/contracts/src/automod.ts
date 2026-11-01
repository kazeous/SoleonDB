import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
import {ruleActionSchema} from './channel-rules.js';
export const automodConfigSchema=z.strictObject({
 enabled:z.boolean(),spam:z.strictObject({enabled:z.boolean(),count:z.number().int().min(1).max(100),windowSeconds:z.number().int().min(1).max(3600)}),
 caps:z.strictObject({enabled:z.boolean(),percent:z.number().int().min(1).max(100)}),bannedWords:z.array(z.string().trim().min(1).max(100)).max(500),blockInvites:z.boolean(),blockLinks:z.boolean(),
 violations:z.strictObject({count:z.number().int().min(1).max(100),windowSeconds:z.number().int().min(1).max(86400)}),action:ruleActionSchema,
 exemptUserIds:z.array(snowflakeSchema).max(100),exemptRoleIds:z.array(snowflakeSchema).max(100),
});
export type AutoModConfig=z.infer<typeof automodConfigSchema>;
export const automodDefaults:AutoModConfig={enabled:false,spam:{enabled:false,count:5,windowSeconds:5},caps:{enabled:false,percent:70},bannedWords:[],blockInvites:false,blockLinks:false,violations:{count:3,windowSeconds:60},action:{kind:'timeout',durationSeconds:600},exemptUserIds:[],exemptRoleIds:[]};


export const autoModSnapshotSchema=z.strictObject({revision:z.number().int().min(1),value:automodConfigSchema});
export type AutoModSnapshot=z.infer<typeof autoModSnapshotSchema>;
