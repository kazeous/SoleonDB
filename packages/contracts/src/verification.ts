import {z} from 'zod';
import emojiRegex from 'emoji-regex';
import {snowflakeSchema} from './ids.js';
export function normalizeEmoji(input:string):{key:string;render:string;id?:string}{
 const value=input.trim(),custom=/^<a?:[a-zA-Z0-9_]{2,32}:([0-9]+)>$/.exec(value);
 if(custom){const id=snowflakeSchema.parse(custom[1]);return {key:'custom:'+id,render:value,id};}
 const matches=value.match(emojiRegex());if(!matches||matches.length!==1||matches[0]!==value)throw new Error('Select one Unicode or accessible custom emoji');
 return {key:'unicode:'+value.normalize('NFC').replaceAll('\uFE0F',''),render:value};
}
export const verificationConfigSchema=z.strictObject({enabled:z.boolean(),channelId:snowflakeSchema.nullable(),roleId:snowflakeSchema.nullable(),emoji:z.string().trim().min(1).max(100).refine(value=>{try{normalizeEmoji(value);return true;}catch{return false;}},'Select one emoji'),prompt:z.string().trim().min(1).max(1000)}).refine(value=>!value.enabled||value.channelId!==null&&value.roleId!==null,'Select a channel and role before enabling');
export type VerificationConfig=z.infer<typeof verificationConfigSchema>;
export const verificationDefaults:VerificationConfig={enabled:false,channelId:null,roleId:null,emoji:'✅',prompt:'React below to verify. Removing your reaction removes the verified role.'};
// Shared by verification and role-picker eligibility checks; never implicitly bypassed for administrators.
export const selfServiceForbiddenPermissions=8n|2n|4n|16n|32n|8192n|268435456n|536870912n|1099511627776n|134217728n|8589934592n|17179869184n|1073741824n|128n;

