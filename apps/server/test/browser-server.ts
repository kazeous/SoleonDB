import {fileURLToPath} from 'node:url';
import {withTestDb} from './database.js';
import {browserFixture} from './browser-fixtures.js';
const port=Number(process.argv[2]);if(!Number.isInteger(port)||port<1)throw new Error('Test port required');
await withTestDb(async db=>{const {app}=browserFixture(db,'http://127.0.0.1:'+port);const server=app.listen(port,'127.0.0.1');await new Promise<void>(resolve=>{for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>server.close(()=>resolve()));});});
