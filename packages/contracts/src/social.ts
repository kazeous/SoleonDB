import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
const hostname=z.string().trim().toLowerCase().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/,'Enter a hostname without scheme, credentials, port or path');
export const socialDomainsSchema=z.strictObject({twitter:hostname,instagram:hostname,tiktok:hostname,reddit:hostname});
export type SocialDomains=z.infer<typeof socialDomainsSchema>;
export const socialConfigSchema=z.strictObject({enabled:z.boolean(),watchedChannelIds:z.array(snowflakeSchema).max(100).refine(ids=>new Set(ids).size===ids.length),domains:socialDomainsSchema,deleteOriginal:z.boolean(),useWebhook:z.boolean(),includeOriginalAuthor:z.boolean()});
export type SocialConfig=z.infer<typeof socialConfigSchema>;
export const socialDefaults:SocialConfig={enabled:false,watchedChannelIds:[],domains:{twitter:'fxtwitter.com',instagram:'ddinstagram.com',tiktok:'tnktok.com',reddit:'rxddit.com'},deleteOriginal:false,useWebhook:false,includeOriginalAuthor:true};
