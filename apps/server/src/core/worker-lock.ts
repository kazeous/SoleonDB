import type {PoolClient} from 'pg';
import type {AppDb} from '../db/client.js';
import {unavailable} from './errors.js';
export interface WorkerLease {acquire():Promise<boolean>;release():Promise<void>;onLost(callback:()=>void):void}
export function createWorkerLease(db:AppDb):WorkerLease {
  let connection:PoolClient|null=null,acquiring=false;
  const listeners=new Set<()=>void>();
  function lost(client:PoolClient){
    if(connection!==client)return;connection=null;client.removeListener('error',onError);client.removeListener('end',onEnd);
    client.release(true);for(const listener of listeners)listener();
  }
  const onError=()=>{if(connection)lost(connection);};const onEnd=()=>{if(connection)lost(connection);};
  return {
    onLost(callback){listeners.add(callback);},
    async acquire(){
      if(connection)return true;if(acquiring)return false;acquiring=true;
      let client:PoolClient|null=null;
      try {
        client=await db.pool.connect();
        await client.query('SELECT set_config($1,$2,false)',['application_name','eousbot-worker-'+db.schemaName]);
        const result=await client.query<{acquired:boolean}>('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',['eousbot-worker:'+db.schemaName]);
        if(!result.rows[0]?.acquired){client.release(true);return false;}
        connection=client;client.on('error',onError);client.on('end',onEnd);return true;
      } catch {client?.release(true);throw unavailable('Worker lease unavailable');}
      finally {acquiring=false;}
    },
    async release(){const client=connection;if(!client)return;connection=null;client.removeListener('error',onError);client.removeListener('end',onEnd);client.release(true);},
  };
}

