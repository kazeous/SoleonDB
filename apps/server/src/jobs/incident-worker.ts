import {randomUUID} from 'node:crypto';
import type {AppDb} from '../db/client.js';
import type {Clock} from '../core/clock.js';
import type {Logger} from '../core/logger.js';
import type {EnforcementService} from '../features/moderation/enforcement.js';
import {createIncidentRepository} from '../features/moderation/incidents.js';
import {createScheduler} from './scheduler.js';
export function createIncidentWorker(deps:{db:AppDb;clock:Clock;logger:Logger;enforcement:EnforcementService;recovery:{recoverPending():Promise<void>};canRun():boolean}) {
 const scheduler=createScheduler(deps.logger),queue=createIncidentRepository(deps.db),workerId=randomUUID();let active=false,unregister=()=>{};
 return {
  key:'moderation' as const,
  async start(){active=true;unregister=scheduler.register('moderation-incidents',1000,async()=>{
   if(!active||!deps.canRun())return;await deps.recovery.recoverPending();
   for(let i=0;i<10&&active&&deps.canRun();i++){const intent=await queue.claimNext(workerId,deps.clock.now());if(!intent)return;await deps.enforcement.dispatch(intent.id);}
  });},
  async stop(){active=false;unregister();await scheduler.stop();},
 };
}

