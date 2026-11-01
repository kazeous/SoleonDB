import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
const result=spawnSync(process.execPath,['node_modules/drizzle-kit/bin.cjs','generate'],{stdio:'inherit'});
if(result.status!==0) process.exit(result.status??1);
// Resolve foreign keys in the same namespace as each created table.
const directory='apps/server/src/db/migrations';
for(const file of readdirSync(directory).filter(f=>f.endsWith('.sql'))) {
  const path=directory+'/'+file;
  writeFileSync(path,readFileSync(path,'utf8').replaceAll('REFERENCES "public".','REFERENCES '));
}
