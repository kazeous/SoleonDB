import {toUSVString} from 'node:util';
import {summaryInputSchema} from '@eousbot/contracts';
import type {ProductivityConfig,Versioned} from '@eousbot/contracts';
import type {MessageSnapshot} from '../../discord/messages.js';
import type {FeatureStatusRegistry} from '../../core/status.js';
import type {Logger} from '../../core/logger.js';
import {AppError} from '../../core/errors.js';
import {buildTranscript,visibleTextMessages} from './transcript.js';
import {localDigest} from './local.js';
export interface SummaryPort{readVisibleMessages(guildId:string,channelId:string,actorId:string,limit:number):Promise<MessageSnapshot[]>}
export interface SummaryProvider{generate(transcript:string,signal:AbortSignal):Promise<string>}
export type SummaryProviders=Partial<Record<'gemini'|'openai',SummaryProvider>>;
export function createSummaryService(deps:{settings:{read(guildId:string,key:'productivity'):Promise<Versioned<ProductivityConfig>>};port:SummaryPort;providers:SummaryProviders;logger:Logger;status:FeatureStatusRegistry;timeoutMs?:number}){return {
 async summarize(raw:{guildId:string;channelId:string;actorId:string;limit:number}):Promise<{text:string;provider:'local'|'gemini'|'openai'}>{
  const parsed=summaryInputSchema.safeParse(raw);if(!parsed.success)throw new AppError('validation','Choose a current server/channel and a history limit from 10 to 100');const input=parsed.data,initial=(await deps.settings.read(input.guildId,'productivity')).value.summaries;if(!initial.enabled)throw new AppError('unavailable','Summaries are disabled in this server');
  const fetched=await deps.port.readVisibleMessages(input.guildId,input.channelId,input.actorId,input.limit);if(fetched.some(message=>message.guildId!==input.guildId||message.channelId!==input.channelId||message.partial))throw new AppError('unavailable','Channel history scope could not be verified');const rows=visibleTextMessages(fetched).slice(-input.limit);if(!rows.length)return {text:localDigest(rows),provider:'local'};
  const config=(await deps.settings.read(input.guildId,'productivity')).value.summaries;if(!config.enabled)throw new AppError('unavailable','Summaries were disabled while reading this channel');
  if(config.provider==='local'||!config.externalEnabled||!config.externalChannelIds.includes(input.channelId))return {text:localDigest(rows),provider:'local'};
  const provider=deps.providers[config.provider];if(!provider){deps.status.set(input.guildId,'productivity','needs_setup','The selected external summary provider needs a deployment key and explicit model.');return {text:localDigest(rows,'The external summary service is not configured. Showing a local digest.'),provider:'local'};}
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;try{const text=await Promise.race([provider.generate(buildTranscript(rows),controller.signal),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Summary deadline exceeded'));},deps.timeoutMs??15000);})]);if(!text.trim())throw new Error('Empty summary');deps.status.set(input.guildId,'productivity','ready');return {text:'**AI summary ('+(config.provider==='openai'?'OpenAI':'Gemini')+')**\n'+toUSVString(text.trim().slice(0,6000).replace(/[\uD800-\uDBFF]$/,'')).replaceAll('@','@\u200b'),provider:config.provider};}
  catch{controller.abort();deps.logger.warn({guildId:input.guildId,provider:config.provider},'External summary unavailable; local digest used');deps.status.set(input.guildId,'productivity','degraded','External summaries are unavailable. Local digests remain available.');return {text:localDigest(rows,'The external summary service is unavailable. Showing a local digest.'),provider:'local'};}
  finally{if(timer)clearTimeout(timer);}
 },
};}
export type SummaryService=ReturnType<typeof createSummaryService>;
