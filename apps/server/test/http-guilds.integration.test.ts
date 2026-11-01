import {it,expect} from 'vitest';
import supertest from 'supertest';
import {withTestDb} from './database.js';
import {httpFixture} from './http-fixtures.js';
import {guildA,guildB} from './directory.js';
it('activation and settings are owner-only, CSRF guarded and revision checked',()=>withTestDb(async db=>{
 const f=httpFixture(db);await f.login();const token=await f.csrf();await f.agent.get('/api/guilds').expect(200);
 const path='/api/guilds/'+guildA;
 await f.agent.put(path+'/settings/moderation').set('x-csrf-token',token).send({revision:0,value:{enabled:false,logChannelId:null}}).expect(403);
 await f.agent.post(path+'/activate').expect(403);await f.agent.post(path+'/activate').set('x-csrf-token',token).expect(200);
 const body={revision:0,value:{enabled:true,logChannelId:'111111111111111111'}};
 await f.agent.put(path+'/settings/moderation').set('x-csrf-token',token).send(body).expect(200);await f.agent.put(path+'/settings/moderation').set('x-csrf-token',token).send(body).expect(409);
 expect((await f.agent.get('/api/guilds/'+guildB+'/settings/moderation').expect(200)).body).toEqual({revision:0,value:{enabled:false,logChannelId:null}});
 const second=supertest.agent(f.app);await second.get(path+'/settings/moderation').expect(401);
}));
it('foreign guild/entities and incomplete permission checks cannot authorize settings',()=>withTestDb(async db=>{
 const f=httpFixture(db);await f.login();const token=await f.csrf();await f.agent.get('/api/guilds').expect(200);const path='/api/guilds/'+guildA;
 await f.agent.post(path+'/activate').set('x-csrf-token',token).expect(200);
 await f.agent.put(path+'/settings/moderation').set('x-csrf-token',token).send({revision:0,value:{enabled:true,logChannelId:'222222222222222222'}}).expect(400);
 await f.agent.post('/api/guilds/999999999999999999/activate').set('x-csrf-token',token).expect(403);
 f.directory.unavailable=true;
 await f.agent.put(path+'/settings/moderation').set('x-csrf-token',token).send({revision:0,value:{enabled:false,logChannelId:null}}).expect(503);
 expect((await db.query('SELECT 1 FROM feature_settings')).rows).toHaveLength(0);
}));
it('selectors bound results and manual punishment routes do not exist',()=>withTestDb(async db=>{
 const f=httpFixture(db);await f.login();const token=await f.csrf();await f.agent.get('/api/guilds').expect(200);
 const response=await f.agent.get('/api/guilds/'+guildA+'/channels').expect(200);expect(response.body.map((c:{id:string})=>c.id)).toEqual(['111111111111111111']);
 for(const route of ['ban','kick','timeout','warn']) await f.agent.post('/api/guilds/'+guildA+'/'+route).set('x-csrf-token',token).expect(404);
}));

