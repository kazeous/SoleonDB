import {it,expect} from 'vitest';
import {withTestDb} from './database.js';
import {createWorkerLease} from '../src/core/worker-lock.js';
it('only one dedicated worker connection owns the lease and loss notifies before reacquisition',()=>withTestDb(async db=>{
 const a=createWorkerLease(db),b=createWorkerLease(db);let lost=false;a.onLost(()=>{lost=true;});
 try {
  expect(await a.acquire()).toBe(true);expect(await b.acquire()).toBe(false);
  const pid=await db.query<{pid:number}>('SELECT pid FROM pg_stat_activity WHERE application_name=$1',['eousbot-worker-'+db.schemaName]);expect(pid.rows).toHaveLength(1);
  await db.query('SELECT pg_terminate_backend($1)',[pid.rows[0]!.pid]);
  await new Promise<void>((resolve,reject)=>{const until=Date.now()+2000;const check=()=>{if(lost)return resolve();if(Date.now()>until)return reject(new Error('lease loss not signalled'));setTimeout(check,10);};check();});
  expect(lost).toBe(true);expect(await b.acquire()).toBe(true);
 } finally {await a.release();await b.release();}
}));

