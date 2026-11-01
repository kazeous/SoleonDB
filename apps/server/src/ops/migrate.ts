import {pathToFileURL} from 'node:url';
import {createDb} from '../db/client.js';
import {migrate} from '../db/migrate.js';
export async function runMigrations(databaseUrl:string|undefined):Promise<void>{if(!databaseUrl)throw new Error('DATABASE_URL must be explicitly supplied');const db=createDb(databaseUrl);try{await migrate(db);}finally{await db.close();}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){runMigrations(process.env.DATABASE_URL).then(()=>process.stdout.write('Migrations applied.\n')).catch(()=>{process.stderr.write('Migration failed; verify the explicit DATABASE_URL. Do not start the release.\n');process.exitCode=1;});}
