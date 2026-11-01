import {createServer} from 'node:http';
import {Events} from 'discord.js';
import type {RuntimeEnv} from './core/env.js';
import {createClock} from './core/clock.js';
import {createLogger} from './core/logger.js';
import {createStatus,FeatureStatusRegistry,checkRequiredIntents} from './core/status.js';
import {createRuntime} from './core/runtime.js';
import {createWorkerLease} from './core/worker-lock.js';
import {createDb} from './db/client.js';
import {readMigrationFiles} from 'drizzle-orm/migrator';
import {migrationsFolder} from './db/migrate.js';
import {createHttpApp} from './http/app.js';
import {createOAuth} from './auth/oauth.js';
import {createDiscordClient,snapshotMessage,interactionContext} from './discord/client.js';
import {createGuildDirectory} from './discord/directory.js';
import {createCommandRouter} from './discord/interactions.js';
import {createMessagePipeline} from './discord/messages.js';
import type {MessageStage} from './discord/messages.js';
import type {FeatureModule} from '@eousbot/contracts';
export function bootstrap(env:RuntimeEnv) {
  const clock=createClock(),logger=createLogger(),status=createStatus(clock),registry=new FeatureStatusRegistry(clock);
  const db=createDb(env.databaseUrl),discord=createDiscordClient(env,status),directory=createGuildDirectory(discord.client),router=createCommandRouter([]);
  const messageStages:MessageStage[]=[],features:FeatureModule[]=[];
  const pipeline=createMessagePipeline(messageStages);
  const app=createHttpApp({env,db,clock,logger,directory,oauth:createOAuth(env),status});const server=createServer(app);
  db.pool.on('error',()=>{status.recordProbe(false);logger.error('Database connection failed');});
  async function accepts(guildId:string):Promise<boolean> {
    if(status.ready().status!==200)return false;
    const row=await db.query<{active:boolean;bot_present:boolean}>('SELECT active,bot_present FROM guilds WHERE id=$1',[guildId]);
    return row.rows[0]?.active===true&&row.rows[0].bot_present===true;
  }
  discord.client.on(Events.InteractionCreate,interaction=>{
    void (async()=>{
      if(!status.snapshot().worker)return;
      const context=await interactionContext(interaction);if(!context)return;
      if(!context.guildId||!await accepts(context.guildId)){await context.reply('This server is not activated or the bot is reconnecting.');return;}
      await router.dispatch(context);
    })().catch(()=>{logger.error({guildId:interaction.guildId},'Interaction handler failed');if(interaction.isRepliable()&&(interaction.deferred||interaction.replied))void interaction.editReply({content:'Action failed. Please retry.',allowedMentions:{parse:[]}}).catch(()=>undefined);});
  });
  const messageHandler=async(message:Parameters<typeof snapshotMessage>[0])=>{
    if(!message.guildId||!await accepts(message.guildId))return;
    if(!env.enableMessageContent){checkRequiredIntents(registry,message.guildId,{messageContent:false,presence:env.enablePresences},[{key:'moderation',messageContent:true},{key:'social',messageContent:true}]);return;}
    const snapshot=await snapshotMessage(message);if(snapshot)await pipeline(snapshot);
  };
  discord.client.on(Events.MessageCreate,message=>{void messageHandler(message).catch(()=>{if(message.guildId)registry.set(message.guildId,'moderation','degraded','Message data or processing unavailable');logger.error({guildId:message.guildId},'Message handler failed');});});
  discord.client.on(Events.MessageUpdate,(_old,message)=>{void messageHandler(message).catch(()=>logger.error({guildId:message.guildId},'Message edit handler failed'));});
  discord.client.on(Events.GuildDelete,guild=>{void db.query('UPDATE guilds SET active=false,bot_present=false WHERE id=$1',[guild.id]).catch(()=>logger.error({guildId:guild.id},'Guild removal persistence failed'));});
  const runtime=createRuntime({clock,status,logger,lease:createWorkerLease(db),discord,features,
    http:{async start(){await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(env.port,'0.0.0.0',()=>{server.removeListener('error',reject);resolve();});});},async stop(){server.closeIdleConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}},
    database:{async probe(signal){signal.throwIfAborted();const client=await db.pool.connect();try{const query={text:'SELECT 1',query_timeout:2000};await client.query(query);}finally{client.release();}},async compatible(){try{const row=await db.query<{hash:string}>('SELECT hash FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1');return row.rows[0]?.hash===readMigrationFiles({migrationsFolder}).at(-1)?.hash;}catch{return false;}},close:()=>db.close()},
  });
  return {runtime,app,db,status,registry,discord,directory,router,messageStages,features,accepts};
}

