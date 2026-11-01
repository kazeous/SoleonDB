import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
import {featureKeySchema,featureStateSchema} from './features.js';
import {moderationCaseSchema} from './cases.js';
export const dashboardStatusSchema=z.strictObject({guildId:snowflakeSchema,connection:z.enum(['starting','ready','disconnected']),database:z.enum(['ready','unavailable']),worker:z.enum(['active','standby']),features:z.array(z.strictObject({key:featureKeySchema,state:featureStateSchema,reason:z.string(),lastSuccessAt:z.number().nullable()})),recentCases:z.array(moderationCaseSchema)});
export type DashboardStatus=z.infer<typeof dashboardStatusSchema>;
