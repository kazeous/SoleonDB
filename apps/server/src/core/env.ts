import type {SummaryProviderConfig} from '../features/summaries/providers.js';
import type {FeedCredentials} from '../features/feeds/providers/common.js';
import { z } from 'zod';
import {isIP} from 'node:net';
import { snowflakeSchema } from '@eousbot/contracts';
import { AppError } from './errors.js';
const schema=z.object({
  DISCORD_TOKEN:z.string().min(1),
  DISCORD_CLIENT_ID:snowflakeSchema,
  DISCORD_CLIENT_SECRET:z.string().min(1),
  OWNER_DISCORD_ID:snowflakeSchema,
  DATABASE_URL:z.url().refine(value=>value.startsWith('postgres://') || value.startsWith('postgresql://')),
  DASHBOARD_REDIRECT_URI:z.url().refine(value=>value.startsWith('http://') || value.startsWith('https://')),
  SESSION_SECRET:z.string().min(32),
  PORT:z.string().regex(/^[0-9]+$/).transform(Number).pipe(z.number().int().min(1).max(65535)).default(3000),
  TRUSTED_PROXY_CIDRS:z.string().default('loopback').transform(value=>value.split(',').map(v=>v.trim()).filter(Boolean)).refine(values=>values.length<=32&&values.every(value=>{if(value==='loopback')return true;const [address,prefix]=value.split('/');const family=isIP(address??'');return family!==0&&(prefix===undefined||(/^[0-9]+$/.test(prefix)&&Number(prefix)<=(family===4?32:128)));})),
  DISCORD_ENABLE_PRESENCES:z.enum(['true','false']).default('false').transform(value=>value==='true'),
  DISCORD_ENABLE_MESSAGE_CONTENT:z.enum(['true','false']).default('true').transform(value=>value==='true'),
  TWITCH_CLIENT_ID:z.string().max(256).default(''),TWITCH_CLIENT_SECRET:z.string().max(4096).default(''),REDDIT_CLIENT_ID:z.string().max(256).default(''),REDDIT_CLIENT_SECRET:z.string().max(4096).default(''),REDDIT_USER_AGENT:z.string().max(256).refine(value=>!/[\r\n]/.test(value)).default(''),
  OPENAI_API_KEY:z.string().max(4096).default(''),GEMINI_API_KEY:z.string().max(4096).default(''),OPENAI_SUMMARY_MODEL:z.string().max(128).regex(/^[a-zA-Z0-9._-]*$/).default(''),GEMINI_SUMMARY_MODEL:z.string().max(128).regex(/^[a-zA-Z0-9._-]*$/).default(''),
  NODE_ENV:z.enum(['development','production','test']).default('development'),
});
export interface RuntimeEnv {
  summaryProviderConfig:SummaryProviderConfig;
  feedCredentials:FeedCredentials;
  discordToken:string; clientId:string; clientSecret:string; ownerId:string;
  databaseUrl:string; redirectUri:string; sessionSecret:string; port:number;
  nodeEnv:'development'|'production'|'test'; trustedProxyCidrs:string[]; enablePresences:boolean; enableMessageContent:boolean;
}
export function parseRuntimeEnv(input:Record<string,string|undefined>):RuntimeEnv {
  const result=schema.safeParse(input);
  if(!result.success) {
    // Forward field names only, never credential or URL values.
    const fields=Object.fromEntries(result.error.issues.map(issue=>[String(issue.path[0]),'Missing or invalid configuration']));
    throw new AppError('validation','Invalid runtime configuration',fields);
  }
  const value=result.data;
  if(value.NODE_ENV==='production' && new URL(value.DASHBOARD_REDIRECT_URI).protocol!=='https:') {
    throw new AppError('validation','Production OAuth redirect requires HTTPS');
  }
  return {summaryProviderConfig:{openaiApiKey:value.OPENAI_API_KEY,openaiModel:value.OPENAI_SUMMARY_MODEL,geminiApiKey:value.GEMINI_API_KEY,geminiModel:value.GEMINI_SUMMARY_MODEL},feedCredentials:{twitchClientId:value.TWITCH_CLIENT_ID,twitchClientSecret:value.TWITCH_CLIENT_SECRET,redditClientId:value.REDDIT_CLIENT_ID,redditClientSecret:value.REDDIT_CLIENT_SECRET,redditUserAgent:value.REDDIT_USER_AGENT},discordToken:value.DISCORD_TOKEN,clientId:value.DISCORD_CLIENT_ID,clientSecret:value.DISCORD_CLIENT_SECRET,ownerId:value.OWNER_DISCORD_ID,databaseUrl:value.DATABASE_URL,redirectUri:value.DASHBOARD_REDIRECT_URI,sessionSecret:value.SESSION_SECRET,port:value.PORT,nodeEnv:value.NODE_ENV,trustedProxyCidrs:value.TRUSTED_PROXY_CIDRS,enablePresences:value.DISCORD_ENABLE_PRESENCES,enableMessageContent:value.DISCORD_ENABLE_MESSAGE_CONTENT};
}

