import type {FeatureModule} from '@eousbot/contracts';
import type {Clock} from './clock.js';
import type {Logger} from './logger.js';
import type {RuntimeStatus} from './status.js';
import type {WorkerLease} from './worker-lock.js';
import {createScheduler} from '../jobs/scheduler.js';
interface Lifecycle {start():Promise<void>;stop():Promise<void>}
export interface RuntimeDeps {
  clock:Clock;status:RuntimeStatus;logger:Logger;http:Lifecycle;lease:WorkerLease;
  database:{probe(signal:AbortSignal):Promise<void>;compatible():Promise<boolean>;close():Promise<void>};
  discord:Lifecycle;features:FeatureModule[];
}
async function bounded<T>(run:(signal:AbortSignal)=>Promise<T>,ms:number):Promise<T> {
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try {return await Promise.race([run(controller.signal),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Operation deadline exceeded'));},ms);})]);}
  finally {if(timer)clearTimeout(timer);}
}
export function createRuntime(deps:RuntimeDeps) {
  const {status,logger}=deps;const scheduler=createScheduler(logger);
  let started=false,stopping=false,active=false,activating=false;
  let deactivation:Promise<void>|null=null;
  const startedFeatures:FeatureModule[]=[];
  async function deactivate(){
    status.setWorker(false);status.setDiscord(false);active=false;
    if(deactivation)return deactivation;
    deactivation=(async()=>{
      for(const feature of startedFeatures.splice(0).reverse())await feature.stop().catch(()=>logger.error({feature:feature.key},'Feature stop failed'));
      await deps.discord.stop().catch(()=>logger.error('Discord stop failed'));
    })().finally(()=>{deactivation=null;});
    return deactivation;
  }
  deps.lease.onLost(()=>{status.setWorker(false);void deactivate();});
  async function probe(){
    try {
      await bounded(signal=>deps.database.probe(signal),2000);
      status.setSchema(await bounded(()=>deps.database.compatible(),2000));status.recordProbe(true);
    } catch {status.recordProbe(false);logger.warn('Database probe failed');}
  }
  async function maintain(){
    if(stopping||active||activating||!status.dependenciesHealthy())return;
    activating=true;
    try {
      if(deactivation)await deactivation;
      if(stopping||!await deps.lease.acquire())return;
      status.setWorker(true);
      await bounded(()=>deps.discord.start(),10000);
      if(stopping||!status.snapshot().worker){await deactivate();return;}
      for(const feature of deps.features){if(stopping||!status.snapshot().worker)return;startedFeatures.push(feature);await feature.start();}
      if(stopping||!status.snapshot().worker){await deactivate();return;}
      active=true;
    } catch {
      logger.error('Worker startup failed');await deactivate();await deps.lease.release();
    } finally {activating=false;}
  }
  async function stop(){
    if(stopping)return;stopping=true;status.setDraining(true);status.setWorker(false);
    try {
      await bounded(async()=>{
        await scheduler.stop();await deactivate();await deps.discord.stop();await deps.lease.release();await deps.http.stop();await deps.database.close();
      },10000);
    } catch {logger.error('Shutdown drain deadline reached');}
  }
  return {
    async start(){
      if(started)return;started=true;
      await deps.http.start();status.setInitialized(true);
      scheduler.register('database-probe',5000,probe);scheduler.register('worker-maintenance',5000,maintain);
      await probe();await maintain();
    },
    stop,
    async fatal(){status.setFatal(true);await stop();},
  };
}

