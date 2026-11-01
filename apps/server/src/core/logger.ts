import pino from 'pino';
import type { DestinationStream, Logger } from 'pino';
export type { Logger } from 'pino';
export function createLogger(destination?:DestinationStream):Logger {
  const names=['token','discordToken','clientSecret','sessionSecret','databaseUrl','password','apiKey','authorization','cookie'];
  const paths=names.flatMap(name=>[name,'*.'+name]);
  const options={redact:{paths,censor:'[REDACTED]'},base:null};
  return destination ? pino(options,destination) : pino(options);
}


