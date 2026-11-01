import {verificationConfigSchema,verificationDefaults} from './verification.js';
import type {z} from 'zod';
import {moderationConfigSchema} from './moderation.js';
import {automodConfigSchema,automodDefaults} from './automod.js';
export interface FeatureConfigMap {verification:z.infer<typeof verificationConfigSchema>;moderation:z.infer<typeof moderationConfigSchema>;automod:z.infer<typeof automodConfigSchema>}
export type SettingsKey=keyof FeatureConfigMap;
export const settingsSchemas:{[K in SettingsKey]:z.ZodType<FeatureConfigMap[K]>}={verification:verificationConfigSchema,moderation:moderationConfigSchema,automod:automodConfigSchema};
export const settingsDefaults:FeatureConfigMap={verification:verificationDefaults,moderation:{enabled:false,logChannelId:null},automod:automodDefaults};
export interface SettingsReferences {channels:Array<{id:string;type:'text'|'voice'|'category'}>;roleIds:string[];memberIds:string[]}
const references:{[K in SettingsKey]:(value:FeatureConfigMap[K])=>SettingsReferences}={
 verification:value=>({channels:value.channelId?[{id:value.channelId,type:'text'}]:[],roleIds:value.roleId?[value.roleId]:[],memberIds:[]}),
 moderation:value=>({channels:value.logChannelId?[{id:value.logChannelId,type:'text'}]:[],roleIds:[],memberIds:[]}),
 automod:value=>({channels:[],roleIds:value.exemptRoleIds,memberIds:value.exemptUserIds}),
};
export function settingsReferences<K extends SettingsKey>(key:K,value:FeatureConfigMap[K]):SettingsReferences {return references[key](value);}
export function isSettingsKey(key:string):key is SettingsKey {return Object.hasOwn(settingsSchemas,key);}

