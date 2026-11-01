import {fileURLToPath,pathToFileURL} from 'node:url';
import {migrate as applyMigrations} from 'drizzle-orm/node-postgres/migrator';
import {createDb} from './client.js';
import type {AppDb} from './client.js';
export const migrationsFolder=fileURLToPath(new URL('./migrations',import.meta.url));
export async function migrate(db:AppDb):Promise<void> {
  const client=await db.pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1,0))',['eousbot-migrations:'+db.schemaName]);
    await applyMigrations(db.orm,{migrationsFolder,migrationsSchema:db.schemaName});
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',['eousbot-migrations:'+db.schemaName]).catch(()=>undefined);
    client.release();
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const url=process.env.DATABASE_URL;
  if(!url) throw new Error('DATABASE_URL must be explicitly supplied');
  const db=createDb(url);
  try {await migrate(db);process.stdout.write('Migrations applied.\n');}
  catch {process.stderr.write('Migration failed; release must not proceed.\n');process.exitCode=1;}
  finally {await db.close();}
}

