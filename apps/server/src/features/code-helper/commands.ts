import type {CommandRouter} from '../../discord/interactions.js';
import {AppError} from '../../core/errors.js';
import type {CodeHelperService} from './service.js';
export function registerCodeHelperCommands(router:CommandRouter,service:CodeHelperService):void{router.register({kind:'component',name:'codehelper',handler:async context=>{if(context.name!=='codehelper:format'||!context.messageId)throw new AppError('validation','This formatting action is unavailable');await service.format(context.guildId!,context.messageId,context.userId!);await context.edit('The formatted copy was sent. The original message is unchanged.');}});}
