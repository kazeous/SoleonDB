import {rolePickerInputSchema,snowflakeSchema} from '@eousbot/contracts';
import type {CommandRouter} from '../../discord/interactions.js';
import type {RolePickerService} from './service.js';
import {AppError} from '../../core/errors.js';
export function registerRolePickerCommands(router:CommandRouter,service:RolePickerService):void{
 router.register({kind:'command',name:'rolepicker',handler:async context=>{
  const permissions=BigInt(context.member!.permissions);if((permissions&(268435456n|8n))===0n)throw new AppError('forbidden','Manage Roles is required');
  const roles=[];for(let i=1;i<=5;i++){const roleId=context.options['role'+i],label=context.options['label'+i],emoji=context.options['emoji'+i];if(roleId||label||emoji){if(!roleId||!label)throw new AppError('validation','Each selected role needs a button label');roles.push({roleId,label,...(emoji?{emoji}:{})});}}
  const input=rolePickerInputSchema.parse({title:context.options.title,description:context.options.description??'',roles}),channelId=snowflakeSchema.parse(context.options.channel??context.channelId),messageId=await service.create(context.guildId!,channelId,context.userId!,input,context.id);
  await context.edit('Role picker registered: https://discord.com/channels/'+context.guildId+'/'+channelId+'/'+messageId);
 }});
 router.register({kind:'component',name:'roles',handler:async context=>{const parts=context.name.split(':');if(parts.length!==2||!context.messageId)throw new AppError('validation','Invalid role picker button');const roleId=snowflakeSchema.parse(parts[1]),result=await service.toggle(context.guildId!,context.messageId,context.userId!,roleId,context.id);await context.edit('Role '+result+'.');}});
}
