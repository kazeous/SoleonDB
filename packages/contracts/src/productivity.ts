import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
const channels=z.array(snowflakeSchema).max(100).refine(ids=>new Set(ids).size===ids.length);
export const summaryConfigSchema=z.strictObject({enabled:z.boolean(),provider:z.enum(['local','gemini','openai']),externalEnabled:z.boolean(),externalChannelIds:channels}).refine(value=>!value.externalEnabled||value.provider!=='local'&&value.externalChannelIds.length>0,'Select an external provider and explicitly allowed channels');
export const codeHelperConfigSchema=z.strictObject({enabled:z.boolean(),channelIds:channels}).refine(value=>!value.enabled||value.channelIds.length>0,'Select code-helper channels');
export const productivityConfigSchema=z.strictObject({summaries:summaryConfigSchema,codeHelper:codeHelperConfigSchema});
export type ProductivityConfig=z.infer<typeof productivityConfigSchema>;
export const productivityDefaults:ProductivityConfig={summaries:{enabled:true,provider:'local',externalEnabled:false,externalChannelIds:[]},codeHelper:{enabled:false,channelIds:[]}};
export const summaryInputSchema=z.strictObject({guildId:snowflakeSchema,channelId:snowflakeSchema,actorId:snowflakeSchema,limit:z.number().int().min(10).max(100)});
