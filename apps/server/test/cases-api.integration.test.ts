import {it,expect} from 'vitest';
import {withTestDb} from './database.js';
import {httpFixture} from './http-fixtures.js';
import {incident} from './enforcement-fixtures.js';
import {fakeClock} from './clock.js';
import {guildA,guildB} from './directory.js';
import {seedGuild} from './database.js';
import {withTransaction} from '../src/db/client.js';
import {withMemberLock} from '../src/db/locks.js';
import {createIncidentRepository} from '../src/features/moderation/incidents.js';
import {randomUUID} from 'node:crypto';
it('read-only case API isolates IDs, validates filters and returns stable cursor pages',()=>withTestDb(async db=>{
 const clock=fakeClock(1000),{intent}=await incident(db,clock);await seedGuild(db,guildB);
 const repo=createIncidentRepository(db);for(let i=0;i<3;i++)await withTransaction(db,tx=>withMemberLock(tx,guildA,intent.userId,()=>repo.create(tx,{...intent,id:randomUUID(),createdAt:1000+i})));
 const f=httpFixture(db);await f.login();const token=await f.csrf();const root='/api/guilds/'+guildA+'/cases';
 const first=(await f.agent.get(root).query({limit:2,memberId:intent.userId,source:'channel_rule',action:'timeout'}).expect(200)).body;expect(first.items).toHaveLength(2);expect(first.nextCursor).toBeTypeOf('string');
 const second=(await f.agent.get(root).query({limit:2,cursor:first.nextCursor,memberId:intent.userId,source:'channel_rule',action:'timeout'}).expect(200)).body;expect(second.items).toHaveLength(2);expect(new Set([...first.items,...second.items].map((c:{id:string})=>c.id)).size).toBe(4);
 await f.agent.get('/api/guilds/'+guildB+'/cases/'+intent.id).expect(404);await f.agent.get(root).query({from:'not-a-date'}).expect(400);await f.agent.get(root).query({limit:101}).expect(400);
 await f.agent.post(root+'/'+intent.id+'/ban').set('x-csrf-token',token).expect(404);await f.agent.patch(root+'/'+intent.id).set('x-csrf-token',token).send({reason:'modified'}).expect(404);
}));

