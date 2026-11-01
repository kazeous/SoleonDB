import {z} from 'zod';
import {channelRuleResponseSchema} from '@eousbot/contracts';
import {api} from '@/lib/api';
export const ruleSchema=channelRuleResponseSchema.transform(({overridesGeneralAutoMod,...rule})=>rule);
export const ruleRoot=(guildId:string)=>'/api/guilds/'+guildId+'/channel-rules';
export const ruleListQuery=(guildId:string)=>({queryKey:['guilds',guildId,'channel-rules'],queryFn:()=>api.get(ruleRoot(guildId),z.array(ruleSchema))});
export const ruleQuery=(guildId:string,id:string)=>({queryKey:['guilds',guildId,'channel-rules',id],queryFn:()=>api.get(ruleRoot(guildId)+'/'+id,ruleSchema)});
