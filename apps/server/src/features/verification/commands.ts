import {snowflakeSchema} from '@eousbot/contracts';
import type {CommandRouter} from '../../discord/interactions.js';
import type {VerificationRepository} from './repository.js';
import type {VerificationService} from './service.js';
import {AppError} from '../../core/errors.js';
export function registerVerificationCommands(router:CommandRouter,service:VerificationService,repository:VerificationRepository):void {
 router.register({kind:'command',name:'verifysetup',handler:async context=>{
  const permissions=BigInt(context.member!.permissions);if((permissions&268435456n)===0n&&(permissions&8n)===0n)throw new AppError('forbidden','Manage Roles permission is required');
  const guildId=context.guildId!,config=(await repository.config(guildId)).value,active=(await repository.listBindings(guildId)).some(binding=>binding.active);
  if(active&&context.options.replace!==true)throw new AppError('conflict','Replacing the panel preserves existing assignments until members react to the replacement. Run /verifysetup with replace:true to acknowledge this generation change.');
  const channelId=snowflakeSchema.parse(context.options.channel??config.channelId),created=await service.setup(guildId,channelId,context.userId!);
  await context.edit('Verification generation '+created.generation+' registered: https://discord.com/channels/'+guildId+'/'+channelId+'/'+created.messageId+'. Existing assignments were preserved.');
 }});
}

