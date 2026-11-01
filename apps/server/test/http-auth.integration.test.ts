import {it,expect} from 'vitest';
import supertest from 'supertest';
import {withTestDb} from './database.js';
import {httpFixture} from './http-fixtures.js';
it('denies unauthenticated and wrong owner without leaking credentials',()=>withTestDb(async db=>{const f=httpFixture(db);await f.agent.get('/api/auth/me').expect(401);await f.login('wrong');const response=await f.agent.get('/api/auth/me').expect(401);expect(JSON.stringify(response.body)).not.toMatch(/test-oauth|test-session|test-bot/);}));
it('rejects missing, incorrect, expired and reused OAuth state',()=>withTestDb(async db=>{
 const f=httpFixture(db);await f.agent.get('/api/auth/discord/callback?code=owner').expect(403);
 let state=await f.begin();await f.agent.get('/api/auth/discord/callback').query({code:'owner',state:'a'.repeat(64)}).expect(403);
 const other=supertest.agent(f.app);await other.get('/api/auth/discord/callback').query({code:'owner',state}).expect(403);
 f.clock.advance(600001);await f.agent.get('/api/auth/discord/callback').query({code:'owner',state}).expect(403);
 state=await f.begin();await f.agent.get('/api/auth/discord/callback').query({code:'owner',state}).expect(302);await f.agent.get('/api/auth/discord/callback').query({code:'owner',state}).expect(403);
}));
it('expires owner session at exactly seven days and stores only hashed opaque IDs',()=>withTestDb(async db=>{
 const f=httpFixture(db);await f.login();expect((await f.agent.get('/api/auth/me').expect(200)).body.owner.id).toBe(f.env.ownerId);
 const rows=await db.query('SELECT id_hash FROM owner_sessions');expect(rows.rows).toHaveLength(1);expect(rows.rows[0].id_hash).toMatch(/^[a-f0-9]{64}$/);
 f.clock.advance(7*24*60*60*1000-1);await f.agent.get('/api/auth/me').expect(200);f.clock.advance(1);await f.agent.get('/api/auth/me').expect(401);
}));
it('logout invalidates server record and requires CSRF and same origin',()=>withTestDb(async db=>{
 const f=httpFixture(db);await f.login();await f.agent.post('/api/auth/logout').expect(403);
 const token=await f.csrf();await f.agent.post('/api/auth/logout').set('x-csrf-token',token).set('Origin','https://attacker.example').expect(403);
 await f.agent.post('/api/auth/logout').set('x-csrf-token',token).expect(204);await f.agent.get('/api/auth/me').expect(401);expect((await db.query('SELECT 1 FROM owner_sessions')).rows).toHaveLength(0);
}));
it('consumes OAuth state atomically across simultaneous callbacks',()=>withTestDb(async db=>{
 const f=httpFixture(db);const state=await f.begin();const results=await Promise.all([f.agent.get('/api/auth/discord/callback').query({code:'owner',state}),f.agent.get('/api/auth/discord/callback').query({code:'owner',state})]);expect(results.map(r=>r.status).sort()).toEqual([302,403]);
}));


it('production cookie requires HTTPS through an explicitly trusted proxy',()=>withTestDb(async db=>{
 const f=httpFixture(db);const {createHttpApp}=await import('../src/http/app.js');
 const {createLogger}=await import('../src/core/logger.js');
 const deps={env:{...f.env,nodeEnv:'production',redirectUri:'https://bot.example/api/auth/discord/callback',trustedProxyCidrs:['loopback']},db,clock:f.clock,logger:createLogger({write(){}}),directory:f.directory,oauth:{authorizationUrl:state=>'https://discord.example/?state='+state,exchange:async()=>({id:f.env.ownerId})},status:{health:()=>({status:200,body:{status:'ok'}}),ready:()=>({status:503,body:{status:'not_ready'}})}} satisfies import('../src/http/app.js').HttpDeps;
 const app=createHttpApp(deps);
 const untrusted=createHttpApp({...deps,env:{...deps.env,trustedProxyCidrs:[]}});
 const rejected=await supertest(untrusted).get('/api/auth/discord').set('X-Forwarded-Proto','https').expect(302);expect(rejected.headers['set-cookie']).toBeUndefined();
 const response=await supertest(app).get('/api/auth/discord').set('X-Forwarded-Proto','https').expect(302);
 expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/);expect(response.headers['set-cookie'][0]).toMatch(/Secure/);expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);
}));
