import {z} from 'zod';
import ipaddr from 'ipaddr.js';
import {snowflakeSchema} from './ids.js';
export function isPublicFeedUrl(value:string):boolean{try{const url=new URL(value),host=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!host.includes('.')&&!host.includes(':')||host==='localhost'||/\.(?:localhost|local|internal|lan|home|localdomain)$/.test(host))return false;if(ipaddr.isValid(host)&&ipaddr.process(host).range()!=='unicast')return false;return true;}catch{return false;}}
export const publicFeedUrlSchema=z.string().trim().max(2048).refine(isPublicFeedUrl,'Enter a public HTTP(S) URL without embedded credentials');
export const feedSourceSchema=z.discriminatedUnion('provider',[
 z.strictObject({provider:z.literal('reddit'),subreddit:z.string().trim().min(2).max(21).regex(/^[a-zA-Z0-9_]+$/)}),
 z.strictObject({provider:z.literal('youtube'),channelId:z.string().trim().regex(/^UC[a-zA-Z0-9_-]{22}$/)}),
 z.strictObject({provider:z.literal('twitch'),login:z.string().trim().toLowerCase().min(1).max(25).regex(/^[a-z0-9_]+$/)}),
 z.strictObject({provider:z.literal('rss'),url:publicFeedUrlSchema}),
]);
export type FeedSource=z.infer<typeof feedSourceSchema>;
export const feedSubscriptionSchema=z.strictObject({id:z.uuid(),enabled:z.boolean(),channelId:snowflakeSchema,source:feedSourceSchema,pollSeconds:z.number().int().min(120).max(3600)});
export type FeedSubscriptionInput=z.infer<typeof feedSubscriptionSchema>;
export const feedsConfigSchema=z.strictObject({enabled:z.boolean(),subscriptions:z.array(feedSubscriptionSchema).max(50).refine(items=>new Set(items.map(item=>item.id)).size===items.length,'Subscription IDs must be unique')}).refine(value=>!value.enabled||value.subscriptions.some(item=>item.enabled),'Add and enable a feed subscription');
export type FeedsConfig=z.infer<typeof feedsConfigSchema>;
export const feedsDefaults:FeedsConfig={enabled:false,subscriptions:[]};
export const feedItemSchema=z.strictObject({id:z.string().min(1).max(500),title:z.string().min(1).max(256),url:publicFeedUrlSchema,publishedAt:z.number().int().min(0).max(8640000000000000),description:z.string().max(2000).optional(),imageUrl:publicFeedUrlSchema.optional()});
export type FeedItem=z.infer<typeof feedItemSchema>;
export const feedPollResultSchema=z.strictObject({items:z.array(feedItemSchema).max(100),cursor:z.string().max(4096).nullable()});
export const feedStatusSchema=z.strictObject({id:z.uuid(),generation:z.number().int(),state:z.enum(['disabled','waiting','ok','degraded','unknown']),lastSuccessAt:z.number().nullable(),nextPollAt:z.number(),unknownDeliveries:z.number().int().nonnegative()});
