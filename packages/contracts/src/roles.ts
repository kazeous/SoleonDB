import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
import {normalizeEmoji} from './verification.js';
export const rolesConfigSchema=z.strictObject({enabled:z.boolean(),assignableRoleIds:z.array(snowflakeSchema).max(100).refine(ids=>new Set(ids).size===ids.length,'Remove duplicate roles')}).refine(value=>!value.enabled||value.assignableRoleIds.length>0,'Choose assignable roles before enabling');
export type RolesConfig=z.infer<typeof rolesConfigSchema>;
export const rolesDefaults:RolesConfig={enabled:false,assignableRoleIds:[]};
export const rolePickerInputSchema=z.strictObject({title:z.string().trim().min(1).max(256),description:z.string().max(4000),roles:z.array(z.strictObject({roleId:snowflakeSchema,label:z.string().trim().min(1).max(80),emoji:z.string().max(100).refine(value=>{try{normalizeEmoji(value);return true;}catch{return false;}},'Choose one emoji').optional()})).min(1).max(5).refine(values=>new Set(values.map(value=>value.roleId)).size===values.length,'Each role may appear once')});
export type RolePickerInput=z.infer<typeof rolePickerInputSchema>;

