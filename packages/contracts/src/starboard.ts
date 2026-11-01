import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
export const starboardConfigSchema=z.strictObject({enabled:z.boolean(),channelId:snowflakeSchema.nullable(),threshold:z.number().int().min(1).max(1000)}).refine(value=>!value.enabled||value.channelId!==null,'Select a starboard channel');
export const starboardDefaults={enabled:false,channelId:null,threshold:3} satisfies z.infer<typeof starboardConfigSchema>;
