import {pathToFileURL} from 'node:url';
import {REST,Routes} from 'discord.js';
import {snowflakeSchema} from '@eousbot/contracts';
import {commandDefinitions} from './commands.js';
import {createDb} from '../db/client.js';
export function parseCommandTargets(args:string[]):{guildId:string}|{activated:true} {
  if(args.length===1&&args[0]==='--activated-guilds')return {activated:true};
  if(args.length===2&&args[0]==='--guild')return {guildId:snowflakeSchema.parse(args[1])};
  throw new Error('Specify --guild <id> or --activated-guilds. Global command deployment is disabled.');
}
async function main(){
  const target=parseCommandTargets(process.argv.slice(2));
  const token=process.env.DISCORD_TOKEN,clientId=snowflakeSchema.parse(process.env.DISCORD_CLIENT_ID);
  if(!token)throw new Error('DISCORD_TOKEN must be explicitly configured');
  if(!commandDefinitions.length)throw new Error('No replacement commands have been registered; refusing to clear existing commands.');
  let guildIds:string[];
  if('guildId' in target)guildIds=[target.guildId];
  else {
    if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required for activated guild deployment');
    const db=createDb(process.env.DATABASE_URL);try{guildIds=(await db.query<{id:string}>('SELECT id FROM guilds WHERE active AND bot_present')).rows.map(row=>row.id);}finally{await db.close();}
  }
  const rest=new REST({version:'10',timeout:15000,retries:0}).setToken(token);
  for(const guildId of guildIds)await rest.put(Routes.applicationGuildCommands(clientId,guildId),{body:commandDefinitions});
  process.stdout.write('Commands deployed to '+guildIds.length+' explicit server(s).\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.stderr.write('Command deployment failed; check target and configuration.\n');process.exitCode=1;});

