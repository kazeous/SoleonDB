import {SlashCommandBuilder,ContextMenuCommandBuilder,ApplicationCommandType} from 'discord.js';
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


commandDefinitions.push(new SlashCommandBuilder().setName('verifysetup').setDescription('Post or explicitly replace the configured reaction verification panel').setDefaultMemberPermissions(268435456n).addChannelOption(option=>option.setName('channel').setDescription('Must match the saved verification channel')).addBooleanOption(option=>option.setName('replace').setDescription('Acknowledge replacement preserves prior assignments until re-verification')).toJSON());
commandDefinitions.push(new SlashCommandBuilder().setName('rolepicker').setDescription('Create a registered self-service role picker').setDefaultMemberPermissions(268435456n).addSubcommand(sub=>{
 sub.setName('create').setDescription('Post a panel with up to five configured roles').addChannelOption(option=>option.setName('channel').setDescription('Destination text channel').setRequired(true)).addStringOption(option=>option.setName('title').setDescription('Panel title').setMaxLength(256).setRequired(true)).addRoleOption(option=>option.setName('role1').setDescription('First configured role').setRequired(true)).addStringOption(option=>option.setName('label1').setDescription('First button label').setMaxLength(80).setRequired(true));
 for(let i=2;i<=5;i++)sub.addRoleOption(option=>option.setName('role'+i).setDescription('Configured role '+i)).addStringOption(option=>option.setName('label'+i).setDescription('Button label '+i).setMaxLength(80));
 for(let i=1;i<=5;i++)sub.addStringOption(option=>option.setName('emoji'+i).setDescription('Optional button emoji '+i).setMaxLength(100));
 return sub.addStringOption(option=>option.setName('description').setDescription('Panel description').setMaxLength(4000));
}).toJSON());
commandDefinitions.push(new SlashCommandBuilder().setName('suggest').setDescription('Submit an idea to this server suggestion board').addStringOption(option=>option.setName('title').setDescription('Short title').setRequired(true).setMaxLength(240)).addStringOption(option=>option.setName('description').setDescription('Explain your idea').setRequired(true).setMaxLength(3500)).toJSON());
commandDefinitions.push(new SlashCommandBuilder().setName('suggestion').setDescription('Manage suggestion status').setDefaultMemberPermissions(8192n).addSubcommand(sub=>sub.setName('status').setDescription('Record a suggestion status and reason').addStringOption(option=>option.setName('message_id').setDescription('Registered suggestion message ID').setRequired(true)).addStringOption(option=>option.setName('status').setDescription('Status').setRequired(true).addChoices({name:'Voting',value:'voting'},{name:'Approved',value:'approved'},{name:'Rejected',value:'rejected'},{name:'In progress',value:'in_progress'},{name:'Implemented',value:'implemented'})).addStringOption(option=>option.setName('reason').setDescription('Reason for this decision').setMaxLength(1000))).toJSON());

commandDefinitions.push(new SlashCommandBuilder().setName('summarize').setDescription('Summarize the recent visible conversation in this channel').addIntegerOption(option=>option.setName('limit').setDescription('Recent messages to inspect (default 50)').setMinValue(10).setMaxValue(100)).toJSON());
commandDefinitions.push(new ContextMenuCommandBuilder().setName('Summarize Discussion').setType(ApplicationCommandType.Message).toJSON());
commandDefinitions.push(new SlashCommandBuilder().setName('catfact').setDescription('Get a cat fact from the public cat fact provider').toJSON());
