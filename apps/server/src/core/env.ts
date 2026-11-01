import { z } from 'zod';
import { snowflakeSchema } from '@eousbot/contracts';
import { AppError } from './errors.js';
const schema=z.object({
  DISCORD_TOKEN:z.string().min(1),
  DISCORD_CLIENT_ID:snowflakeSchema,
  DISCORD_CLIENT_SECRET:z.string().min(1),
  OWNER_DISCORD_ID:snowflakeSchema,
  DATABASE_URL:z.url().refine(value=>['postgres:','postgresql:'].includes(new URL(value).protocol)),
  DASHBOARD_REDIRECT_URI:z.url().refine(value=>['http:','https:'].includes(new URL(value).protocol)),
  SESSION_SECRET:z.string().min(32),
  PORT:z.string().regex(/^[0-9]+$/).transform(Number).pipe(z.number().int().min(1).max(65535)).default(3000),
  NODE_ENV:z.enum(['development','production','test']).default('development'),
});
export interface RuntimeEnv {
  discordToken:string; clientId:string; clientSecret:string; ownerId:string;
  databaseUrl:string; redirectUri:string; sessionSecret:string; port:number;
  nodeEnv:'development'|'production'|'test';
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
  return {discordToken:value.DISCORD_TOKEN,clientId:value.DISCORD_CLIENT_ID,clientSecret:value.DISCORD_CLIENT_SECRET,ownerId:value.OWNER_DISCORD_ID,databaseUrl:value.DATABASE_URL,redirectUri:value.DASHBOARD_REDIRECT_URI,sessionSecret:value.SESSION_SECRET,port:value.PORT,nodeEnv:value.NODE_ENV};
}

