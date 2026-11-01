import supertest from 'supertest';
import {createHttpApp} from '../src/http/app.js';
import {parseRuntimeEnv} from '../src/core/env.js';
import {createLogger} from '../src/core/logger.js';
import type {AppDb} from '../src/db/client.js';
import {fakeClock} from './clock.js';
import {FakeDirectory,ownerId} from './directory.js';
export function httpFixture(db:AppDb,status?:import('../src/http/app.js').HealthReader){
 const clock=fakeClock(Date.now());const directory=new FakeDirectory();
 const env=parseRuntimeEnv({DISCORD_TOKEN:'test-bot-not-live',DISCORD_CLIENT_ID:ownerId,DISCORD_CLIENT_SECRET:'test-oauth-not-live',OWNER_DISCORD_ID:ownerId,DATABASE_URL:'postgresql://unused/test',DASHBOARD_REDIRECT_URI:'http://localhost:3000/api/auth/discord/callback',SESSION_SECRET:'test-session-secret-at-least-32-characters',NODE_ENV:'test'});
 const oauth={authorizationUrl:(state:string)=>'https://discord.example/authorize?state='+state,exchange:async(code:string)=>({id:code==='wrong'?'999999999999999999':ownerId})};
 const app=createHttpApp({env,db,clock,logger:createLogger({write(){}}),directory,oauth,status:status??{health:()=>({status:200,body:{status:'ok'}}),ready:()=>({status:503,body:{status:'not_ready'}})}});
 const agent=supertest.agent(app);
 async function begin(jar=agent){const start=await jar.get('/api/auth/discord').expect(302);return new URL(start.headers.location).searchParams.get('state')!;}
 async function login(code='owner',jar=agent){const state=await begin(jar);await jar.get('/api/auth/discord/callback').query({state,code}).expect(code==='wrong'?403:302);return jar;}
 async function csrf(jar=agent){return (await jar.get('/api/auth/me').expect(200)).body.csrfToken as string;}
 return {app,agent,clock,directory,env,begin,login,csrf};
}

