import {it,expect,vi,afterEach} from 'vitest';
import {createStatus,FeatureStatusRegistry,checkRequiredIntents} from '../src/core/status.js';
import {createRuntime} from '../src/core/runtime.js';
import {createScheduler} from '../src/jobs/scheduler.js';
import {fakeClock} from './clock.js';
import {createLogger} from '../src/core/logger.js';
afterEach(()=>vi.useRealTimers());
it('health stays live while disconnected but readiness requires fresh dependencies',()=>{
 const clock=fakeClock(10000),status=createStatus(clock);status.setInitialized(true);
 expect(status.health()).toEqual({status:200,body:{status:'ok'}});expect(status.ready().status).toBe(503);
 status.setWorker(true);status.setSchema(true);status.setDiscord(true);status.recordProbe(true);
 expect(status.ready().status).toBe(200);clock.advance(10000);expect(status.ready().status).toBe(200);clock.advance(1);expect(status.ready().status).toBe(503);
 status.recordProbe(true);status.setDraining(true);expect(status.health().status).toBe(503);expect(status.ready().status).toBe(503);
});
it('required intents degrade only the affected configured features',()=>{
 const registry=new FeatureStatusRegistry(fakeClock());
 checkRequiredIntents(registry,'9223372036854775807',{messageContent:false,presence:false},[{key:'social',messageContent:true},{key:'voice',presence:true}]);
 expect(registry.list('9223372036854775807')).toEqual(expect.arrayContaining([expect.objectContaining({key:'social',state:'degraded'}),expect.objectContaining({key:'voice',state:'degraded'})]));expect(registry.list('9223372036854775808')).toEqual([]);
});
it('starts HTTP first, one worker only, stops on lease loss and drains timers',async()=>{
 vi.useFakeTimers();const clock=fakeClock(100),status=createStatus(clock),events:string[]=[];let lost=()=>{};let available=false;
 const runtime=createRuntime({clock,status,logger:createLogger({write(){}}),http:{async start(){events.push('http');},async stop(){events.push('http-stop');}},database:{async probe(){events.push('probe');},async compatible(){return true;},async close(){events.push('db-stop');}},lease:{async acquire(){events.push('lease');return available;},async release(){events.push('release');},onLost(cb){lost=cb;}},discord:{async start(){events.push('discord');status.setDiscord(true);},async stop(){events.push('discord-stop');status.setDiscord(false);}},features:[{key:'social',async start(){events.push('jobs');},async stop(){events.push('jobs-stop');}}]});
 await runtime.start();expect(events[0]).toBe('http');expect(events).not.toContain('discord');expect(status.ready().status).toBe(503);
 available=true;await vi.advanceTimersByTimeAsync(5000);expect(events.filter(e=>e==='discord')).toHaveLength(1);expect(status.ready().status).toBe(200);
 available=false;lost();expect(status.ready().status).toBe(503);await vi.advanceTimersByTimeAsync(1);expect(events).toContain('jobs-stop');
 await runtime.stop();expect(status.health().status).toBe(503);expect(vi.getTimerCount()).toBe(0);
});
it('scheduler does not overlap a slow job and unregisters timers',async()=>{
 vi.useFakeTimers();let release=()=>{};let calls=0;
 const scheduler=createScheduler(createLogger({write(){}}));
 const unregister=scheduler.register('slow',100,async()=>{calls++;await new Promise<void>(r=>{release=r;});});
 await vi.advanceTimersByTimeAsync(500);expect(calls).toBe(1);release();await vi.advanceTimersByTimeAsync(100);expect(calls).toBe(2);release();unregister();await scheduler.stop();expect(vi.getTimerCount()).toBe(0);
});


it('unregister stops new ticks while shutdown still drains running work',async()=>{
 vi.useFakeTimers();let release=()=>{};let drained=false;
 const scheduler=createScheduler(createLogger({write(){}}));const unregister=scheduler.register('pending',100,async()=>new Promise<void>(r=>{release=r;}));
 await vi.advanceTimersByTimeAsync(100);unregister();const stopping=scheduler.stop().then(()=>{drained=true;});await Promise.resolve();await Promise.resolve();expect(drained).toBe(false);release();await stopping;expect(drained).toBe(true);
});

it('HTTP probes bypass unavailable session storage and reflect actual dependency status',async()=>{
 const {httpFixture}=await import('./http-fixtures.js');const clock=fakeClock(0),status=createStatus(clock);status.setInitialized(true);
 const f=httpFixture({query:async()=>{throw new Error('Database unavailable');}} as never,status);
 expect((await f.agent.get('/health').expect(200)).body).toEqual({status:'ok'});expect((await f.agent.get('/ready').expect(503)).body).toEqual({status:'not_ready'});
 status.setWorker(true);status.setSchema(true);status.setDiscord(true);status.recordProbe(true);await f.agent.get('/ready').expect(200);clock.advance(10001);await f.agent.get('/ready').expect(503);
});
it('fatal state drains and cannot remain healthy',async()=>{
 vi.useFakeTimers();const clock=fakeClock(),status=createStatus(clock);let closed=false;
 const runtime=createRuntime({clock,status,logger:createLogger({write(){}}),http:{async start(){},async stop(){closed=true;}},database:{async probe(){},async compatible(){return true;},async close(){}},lease:{async acquire(){return false;},async release(){},onLost(){}},discord:{async start(){},async stop(){}},features:[]});
 await runtime.start();expect(status.health().status).toBe(200);await runtime.fatal();expect(status.health().status).toBe(503);expect(closed).toBe(true);expect(vi.getTimerCount()).toBe(0);
});

it('keeps database probes fresh while Discord startup is still pending',async()=>{
 vi.useFakeTimers();const clock=fakeClock(0),status=createStatus(clock);let ready=()=>{};const gateway=new Promise<void>(r=>{ready=r;});
 const runtime=createRuntime({clock,status,logger:createLogger({write(){}}),http:{async start(){},async stop(){}},database:{async probe(){},async compatible(){return true;},async close(){}},lease:{async acquire(){return true;},async release(){},onLost(){}},discord:{async start(){await gateway;status.setDiscord(true);},async stop(){status.setDiscord(false);}},features:[]});
 const starting=runtime.start();for(let i=0;i<10;i++)await Promise.resolve();clock.advance(11001);await vi.advanceTimersByTimeAsync(5000);ready();await starting;expect(status.ready().status).toBe(200);await runtime.stop();
});
