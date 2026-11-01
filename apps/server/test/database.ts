import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {createDb} from '../src/db/client.js';
import type {AppDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
export function assertTestSchema(name:string):void {
  if(!/^eousbot_test_[a-f0-9]{24}$/.test(name)) throw new Error('Refusing non-test schema');
}
export async function withTestDb(fn:(db:AppDb)=>Promise<void>):Promise<void> {
  const url=process.env.TEST_DATABASE_URL;
  if(!url) throw new Error('Missing TEST_DATABASE_URL: start the dedicated compose.test.yml PostgreSQL service');
  const name='eousbot_test_'+randomBytes(12).toString('hex');assertTestSchema(name);
  const admin=new Pool({connectionString:url,connectionTimeoutMillis:2000,max:1});
  let db:AppDb|undefined;
  try {
    await admin.query('CREATE SCHEMA '+name);
    db=createDb(url,{schema:name});await migrate(db);await fn(db);
  } finally {
    if(db) await db.close();
    assertTestSchema(name);
    await admin.query('DROP SCHEMA IF EXISTS '+name+' CASCADE');await admin.end();
  }
}
export async function seedGuild(db:AppDb,id:string):Promise<void> {
  await db.query('INSERT INTO guilds(id,name,active) VALUES($1,$2,true) ON CONFLICT(id) DO NOTHING',[id,'Test server']);
}

