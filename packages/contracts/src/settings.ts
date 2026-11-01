import { z } from 'zod';
import { snowflakeSchema } from './ids.js';
export const moderationConfigSchema=z.strictObject({enabled:z.boolean(),logChannelId:snowflakeSchema.nullable()});
export interface FeatureConfigMap { moderation:z.infer<typeof moderationConfigSchema> }
export const settingsSchemas={moderation:moderationConfigSchema};
export const settingsDefaults:FeatureConfigMap={moderation:{enabled:false,logChannelId:null}};
export type SettingsKey=keyof FeatureConfigMap;
export function isSettingsKey(key:string):key is SettingsKey { return Object.hasOwn(settingsSchemas,key); }

