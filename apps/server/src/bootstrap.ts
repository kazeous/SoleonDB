import {createServer} from 'node:http';
import {createVerificationRepository} from './features/verification/repository.js';
import {createVerificationService} from './features/verification/service.js';
import {createVerificationPort,registerVerificationEvents} from './features/verification/discord.js';
import {registerVerificationCommands} from './features/verification/commands.js';
import {createCommandAuthority,createCleanMessagePort} from './discord/moderation-commands.js';
import {createModerationActions} from './features/moderation/actions.js';
import {createCleanService} from './features/moderation/clean.js';
import {createCaseRepository} from './features/moderation/cases.js';
import {registerModerationCommands,assertCommandAuthority} from './features/moderation/commands.js';
import {createGeneralAutoMod,createProtectionStage} from './features/automod/service.js';
import {createRuleRepository} from './features/protection/repository.js';
import {createEnforcementService} from './features/moderation/enforcement.js';
import {createRecoveryService} from './features/moderation/recovery.js';
import {createCaseLogger} from './features/moderation/logging.js';
import {createModerationPort,createModerationLogPort} from './discord/moderation.js';
import {createIncidentWorker} from './jobs/incident-worker.js';
import {createProtectionEngine} from './features/protection/engine.js';
import {createObservationRepository} from './features/protection/observations.js';
import {registerPruning} from './db/pruning.js';
import {createScheduler} from './jobs/scheduler.js';
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
  const protection=createProtectionEngine(db,clock),observationStore=createObservationRepository(db),pruneScheduler=createScheduler(logger);
  const generalAutoMod=createGeneralAutoMod(db,clock);
  messageStages.push(createProtectionStage(protection,generalAutoMod,createRuleRepository(db)));
  let unregisterPruning=()=>{};
  features.push({key:'moderation',async start(){unregisterPruning=registerPruning(pruneScheduler,[limit=>observationStore.prune(clock.now(),limit),limit=>generalAutoMod.prune(clock.now(),limit)]);},async stop(){unregisterPruning();await pruneScheduler.stop();}});
  const canDispatch=()=>status.ready().status===200;
  const moderationPort=createModerationPort(discord.client,canDispatch);
  const relatedMessages={async list(_guildId:string,_sourceMessageId:string):Promise<Array<{channelId:string;messageId:string}>>{return [];}};
  const commandAuthority=createCommandAuthority(discord.client);
  const enforcement=createEnforcementService({db,clock,port:moderationPort,related:relatedMessages,canDispatch,authorizeCommand:async intent=>{if(intent.actorId&&intent.command)assertCommandAuthority(intent.command,await commandAuthority.inspect(intent.guildId,intent.actorId,intent.userId));},log:createCaseLogger({db,logger,registry,port:createModerationLogPort(discord.client,canDispatch)})});
  const moderationActions=createModerationActions({db,clock,authority:commandAuthority,enforcement});
  const cleanService=createCleanService({db,clock,authority:commandAuthority,enforcement,port:createCleanMessagePort(discord.client)});
  registerModerationCommands(router,{authority:commandAuthority,actions:moderationActions,cases:createCaseRepository(db),clean:cleanService});
  const recovery=createRecoveryService({db,clock,port:moderationPort});
  features.push(createIncidentWorker({db,clock,logger,enforcement,recovery,canRun:canDispatch}));
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
  const verificationRepository=createVerificationRepository(db,clock);
  const verification=createVerificationService({repository:verificationRepository,port:createVerificationPort(discord.client,accepts),clock,status:registry});
  registerVerificationCommands(router,verification,verificationRepository);
  const verificationScheduler=createScheduler(logger);let verificationActive=false,removeVerificationEvents=()=>{},removeVerificationTimer=()=>{};let verificationRun:Promise<void>|null=null;
  const reconcileVerification=():Promise<void>=>{
   if(verificationRun)return verificationRun;
   verificationRun=(async()=>{const guilds=await db.query<{id:string}>('SELECT id FROM guilds WHERE active AND bot_present');for(const guild of guilds.rows)if(verificationActive&&await accepts(guild.id))await verification.reconcile(guild.id);})().catch(()=>logger.error('Verification reconciliation failed')).finally(()=>{verificationRun=null;});return verificationRun;
  };
  const verificationReconnect=()=>{if(verificationActive)void reconcileVerification();};
  features.push({key:'verification',async start(){verificationActive=true;removeVerificationEvents=registerVerificationEvents(discord.client,verification,accepts,logger);discord.client.on(Events.ClientReady,verificationReconnect);discord.client.on(Events.ShardResume,verificationReconnect);removeVerificationTimer=verificationScheduler.register('verification-reconciliation',300000,reconcileVerification);await reconcileVerification();},async stop(){verificationActive=false;removeVerificationEvents();removeVerificationTimer();discord.client.off(Events.ClientReady,verificationReconnect);discord.client.off(Events.ShardResume,verificationReconnect);await verificationScheduler.stop();await verificationRun;}});
  const runtime=createRuntime({clock,status,logger,lease:createWorkerLease(db),discord,features,
    http:{async start(){await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(env.port,'0.0.0.0',()=>{server.removeListener('error',reject);resolve();});});},async stop(){server.closeIdleConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}},
    database:{async probe(signal){signal.throwIfAborted();const client=await db.pool.connect();try{const query={text:'SELECT 1',query_timeout:2000};await client.query(query);}finally{client.release();}},async compatible(){try{const row=await db.query<{hash:string}>('SELECT hash FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1');return row.rows[0]?.hash===readMigrationFiles({migrationsFolder}).at(-1)?.hash;}catch{return false;}},close:()=>db.close()},
  });
  return {runtime,app,db,status,registry,discord,directory,router,messageStages,features,accepts,enforcement,moderationPort,relatedMessages,verification};
}

