import {SlashCommandBuilder} from 'discord.js';
import type {RESTPostAPIApplicationCommandsJSONBody} from 'discord.js';
import {requiredPermission} from '../features/moderation/commands.js';
const moderation=['warn','timeout','kick','ban','cases','clean'] as const;
export const commandDefinitions:RESTPostAPIApplicationCommandsJSONBody[]=moderation.map(name=>{
 const command=new SlashCommandBuilder().setName(name).setDescription({warn:'Record a formal warning',timeout:'Timeout a member',kick:'Kick a member',ban:'Permanently ban a member',cases:'Read server moderation case history',clean:'Delete selected recent messages'}[name]).setDefaultMemberPermissions(requiredPermission[name]);
 if(name==='clean')command.addIntegerOption(option=>option.setName('amount').setDescription('Number of messages to inspect').setMinValue(1).setMaxValue(100).setRequired(true)).addStringOption(option=>option.setName('filter').setDescription('Message filter').addChoices({name:'Only bots',value:'only-bots'},{name:'Only humans',value:'only-users'},{name:'Links',value:'contain-links'},{name:'Invites',value:'contain-invites'},{name:'Text only',value:'text-only'})).addUserOption(option=>option.setName('user').setDescription('Only this author'));
 else {
  command.addUserOption(option=>option.setName('user').setDescription('Server member').setRequired(true));
  if(name==='timeout')command.addIntegerOption(option=>option.setName('duration').setDescription('Timeout duration in minutes').setMinValue(1).setMaxValue(40320).setRequired(true));
  if(name!=='cases')command.addStringOption(option=>option.setName('reason').setDescription('Reason').setMaxLength(512));
 }
 return command.toJSON();
});

