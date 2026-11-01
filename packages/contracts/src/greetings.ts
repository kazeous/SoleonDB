import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
export function validGreetingTemplate(value:string):boolean{return !value.replaceAll(/\{(?:user|username|server)\}/g,'').match(/[{}]/);}
const template=z.string().max(1500).refine(validGreetingTemplate,'Supported variables: {user}, {username}, {server}');
export const greetingsConfigSchema=z.strictObject({enabled:z.boolean(),joinChannelId:snowflakeSchema.nullable(),leaveChannelId:snowflakeSchema.nullable(),joinTemplate:template,leaveTemplate:template,dmEnabled:z.boolean(),dmTemplate:template});
export type GreetingsConfig=z.infer<typeof greetingsConfigSchema>;
export const greetingsDefaults:GreetingsConfig={enabled:false,joinChannelId:null,leaveChannelId:null,joinTemplate:'Welcome {user} to {server}!',leaveTemplate:'{username} left {server}.',dmEnabled:false,dmTemplate:'Welcome to {server}, {username}!'};
