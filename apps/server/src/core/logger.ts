import pino from 'pino';
import type { DestinationStream, Logger } from 'pino';
export type { Logger } from 'pino';
export function createLogger(destination?:DestinationStream):Logger {
  const names=['token','discordToken','clientSecret','sessionSecret','databaseUrl','password','apiKey','authorization','cookie','Authorization','Cookie','twitchClientSecret','redditClientSecret','TWITCH_CLIENT_SECRET','REDDIT_CLIENT_SECRET','access_token','client_secret','GEMINI_API_KEY','OPENAI_API_KEY','openaiApiKey','geminiApiKey'];
  const paths=names.flatMap(name=>[name,'*.'+name,'*.*.'+name]);
  const options={redact:{paths,censor:'[REDACTED]'},base:null};
  return destination ? pino(options,destination) : pino(options);
}


