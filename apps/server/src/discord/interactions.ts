import type {MemberRef} from '@eousbot/contracts';
import {AppError} from '../core/errors.js';
export interface CommandContext {
  id:string;name:string;kind:'command'|'context'|'component';
  guildId:string|null;channelId:string|null;userId:string|null;member:MemberRef|null;
  messageId?:string;options:Record<string,unknown>;
  reply(text:string):Promise<void>;defer():Promise<void>;edit(text:string):Promise<void>;
}
export type CommandHandler=(interaction:CommandContext)=>Promise<void>;
export interface CommandRegistration {name:string;kind:CommandContext['kind'];handler:CommandHandler}
export function createCommandRouter(registrations:CommandRegistration[],now:()=>number=Date.now) {
  const handlers=new Map<string,CommandHandler>(),seen=new Map<string,number>();
  function register(registration:CommandRegistration){
    const key=registration.kind+':'+registration.name;if(handlers.has(key))throw new Error('Duplicate interaction registration');handlers.set(key,registration.handler);
  }
  registrations.forEach(register);
  return {
    register,
    async dispatch(context:CommandContext):Promise<void> {
      const time=now();for(const [id,at] of seen){if(time-at>900000||seen.size>10000)seen.delete(id);else break;}
      if(seen.has(context.id))return;
      if(!context.guildId||!context.channelId||!context.userId||!context.member){await context.reply('Use this action in a server with an available member identity.');return;}
      const name=context.kind==='component'?context.name.split(':')[0]:context.name;
      const handler=handlers.get(context.kind+':'+name);
      if(!handler){await context.reply('This action is unavailable or expired.');return;}
      seen.set(context.id,time);
      await context.defer();
      try {await handler(context);}catch(error){await context.edit(error instanceof AppError?error.message:'Action failed. Please retry.');}
    },
  };
}
export type CommandRouter=ReturnType<typeof createCommandRouter>;

