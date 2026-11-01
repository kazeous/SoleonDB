import {productivityConfigSchema,productivityDefaults} from './productivity.js';
import {feedsConfigSchema,feedsDefaults} from './feeds.js';
import {socialConfigSchema,socialDefaults} from './social.js';
import {threadsConfigSchema,threadsDefaults} from './threads.js';
import {starboardConfigSchema,starboardDefaults} from './starboard.js';
import {suggestionsConfigSchema,suggestionsDefaults} from './suggestions.js';
import {voiceConfigSchema,voiceDefaults} from './voice.js';
import {greetingsConfigSchema,greetingsDefaults} from './greetings.js';
import {rolesConfigSchema,rolesDefaults} from './roles.js';
import {verificationConfigSchema,verificationDefaults} from './verification.js';
import type {z} from 'zod';
import {moderationConfigSchema} from './moderation.js';
import {automodConfigSchema,automodDefaults} from './automod.js';
export interface FeatureConfigMap {productivity:z.infer<typeof productivityConfigSchema>;feeds:z.infer<typeof feedsConfigSchema>;social:z.infer<typeof socialConfigSchema>;threads:z.infer<typeof threadsConfigSchema>;starboard:z.infer<typeof starboardConfigSchema>;suggestions:z.infer<typeof suggestionsConfigSchema>;voice:z.infer<typeof voiceConfigSchema>;greetings:z.infer<typeof greetingsConfigSchema>;roles:z.infer<typeof rolesConfigSchema>;verification:z.infer<typeof verificationConfigSchema>;moderation:z.infer<typeof moderationConfigSchema>;automod:z.infer<typeof automodConfigSchema>}
export type SettingsKey=keyof FeatureConfigMap;
export const settingsSchemas:{[K in SettingsKey]:z.ZodType<FeatureConfigMap[K]>}={productivity:productivityConfigSchema,feeds:feedsConfigSchema,social:socialConfigSchema,threads:threadsConfigSchema,starboard:starboardConfigSchema,suggestions:suggestionsConfigSchema,voice:voiceConfigSchema,greetings:greetingsConfigSchema,roles:rolesConfigSchema,verification:verificationConfigSchema,moderation:moderationConfigSchema,automod:automodConfigSchema};
export const settingsDefaults:FeatureConfigMap={productivity:productivityDefaults,feeds:feedsDefaults,social:socialDefaults,threads:threadsDefaults,starboard:starboardDefaults,suggestions:suggestionsDefaults,voice:voiceDefaults,greetings:greetingsDefaults,roles:rolesDefaults,verification:verificationDefaults,moderation:{enabled:false,logChannelId:null},automod:automodDefaults};
export interface SettingsReferences {channels:Array<{id:string;type:'text'|'voice'|'category'}>;roleIds:string[];memberIds:string[]}
const references:{[K in SettingsKey]:(value:FeatureConfigMap[K])=>SettingsReferences}={
 productivity:value=>({channels:[...value.summaries.externalChannelIds,...value.codeHelper.channelIds].map(id=>({id,type:'text'})),roleIds:[],memberIds:[]}),
 feeds:value=>({channels:value.subscriptions.map(item=>({id:item.channelId,type:'text'})),roleIds:[],memberIds:[]}),
 social:value=>({channels:value.watchedChannelIds.map(id=>({id,type:'text'})),roleIds:[],memberIds:[]}),
 threads:value=>({channels:value.channelIds.map(id=>({id,type:'text'})),roleIds:[],memberIds:[]}),
 starboard:value=>({channels:value.channelId?[{id:value.channelId,type:'text'}]:[],roleIds:[],memberIds:[]}),
 suggestions:value=>({channels:value.channelId?[{id:value.channelId,type:'text'}]:[],roleIds:[],memberIds:[]}),
 voice:value=>({channels:value.hubChannelIds.map(id=>({id,type:'voice'})),roleIds:[],memberIds:[]}),
 greetings:value=>({channels:[value.joinChannelId,value.leaveChannelId].filter((id):id is string=>id!==null).map(id=>({id,type:'text'})),roleIds:[],memberIds:[]}),
 roles:value=>({channels:[],roleIds:value.assignableRoleIds,memberIds:[]}),
 verification:value=>({channels:value.channelId?[{id:value.channelId,type:'text'}]:[],roleIds:value.roleId?[value.roleId]:[],memberIds:[]}),
 moderation:value=>({channels:value.logChannelId?[{id:value.logChannelId,type:'text'}]:[],roleIds:[],memberIds:[]}),
 automod:value=>({channels:[],roleIds:value.exemptRoleIds,memberIds:value.exemptUserIds}),
};
export function settingsReferences<K extends SettingsKey>(key:K,value:FeatureConfigMap[K]):SettingsReferences {return references[key](value);}
export function isSettingsKey(key:string):key is SettingsKey {return Object.hasOwn(settingsSchemas,key);}

