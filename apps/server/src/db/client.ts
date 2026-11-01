import { Pool } from 'pg';
import type { QueryResult,QueryResultRow } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
export interface SqlSession {
  query<R extends QueryResultRow=QueryResultRow>(text:string,values?:unknown[]):Promise<QueryResult<R>>;
  orm:NodePgDatabase<typeof schema>;
}
export interface AppDb extends SqlSession { pool:Pool; schemaName:string; close():Promise<void> }
export interface AppTx extends SqlSession { readonly inTransaction:true }
export function createDb(databaseUrl:string,options:{schema?:string;max?:number}={}):AppDb {
  const schemaName=options.schema??'public';
  if(schemaName!=='public' && !/^eousbot_test_[a-f0-9]{24}$/.test(schemaName)) throw new Error('Invalid database schema');
  const pool=new Pool({connectionString:databaseUrl,max:options.max??10,connectionTimeoutMillis:2000,options:'-c search_path='+schemaName+',public'});
  return {pool,schemaName,orm:drizzle(pool,{schema}),query:(text,values)=>pool.query(text,values),close:()=>pool.end()};
}
export async function withTransaction<T>(db:AppDb,fn:(tx:AppTx)=>Promise<T>):Promise<T> {
  const client=await db.pool.connect();
  try {
    await client.query('BEGIN');
    const tx:AppTx={inTransaction:true,orm:drizzle(client,{schema}),query:(text,values)=>client.query(text,values)};
    const result=await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>undefined);
    throw error;
  } finally {client.release();}
}

