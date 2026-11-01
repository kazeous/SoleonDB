import type {AppDb} from '../../db/client.js';
import type {Clock} from '../../core/clock.js';
import type {Logger} from '../../core/logger.js';
import type {FeedDelivery} from './delivery.js';
import {createFeedRepository} from './repository.js';
import {createScheduler} from '../../jobs/scheduler.js';
export function createFeedScheduler(deps:{db:AppDb;clock:Clock;logger:Logger;delivery:FeedDelivery;canRun():boolean}){const repository=createFeedRepository(deps.db,deps.clock),scheduler=createScheduler(deps.logger);let active=false,remove=()=>{};return {key:'feeds' as const,async start(){active=true;remove=scheduler.register('feed-polls',2000,async()=>{if(!active||!deps.canRun())return;const due=await repository.due(4);await Promise.all(due.map(id=>deps.delivery.run(id)));});},async stop(){active=false;remove();await scheduler.stop();}};}
