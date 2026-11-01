import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
export const threadsConfigSchema=z.strictObject({enabled:z.boolean(),channelIds:z.array(snowflakeSchema).max(100).refine(ids=>new Set(ids).size===ids.length),autoArchiveDuration:z.union([z.literal(60),z.literal(1440),z.literal(4320),z.literal(10080)])});
export type ThreadsConfig=z.infer<typeof threadsConfigSchema>;
export const threadsDefaults:ThreadsConfig={enabled:false,channelIds:[],autoArchiveDuration:1440};
