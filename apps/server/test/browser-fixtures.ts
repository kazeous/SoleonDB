import {fileURLToPath} from 'node:url';
import {createHttpApp} from '../src/http/app.js';
import {registerDashboard} from '../src/http/dashboard.js';
import {parseRuntimeEnv} from '../src/core/env.js';
import {createLogger} from '../src/core/logger.js';
import type {AppDb} from '../src/db/client.js';
import {fakeClock} from './clock.js';
import {FakeDirectory,ownerId} from './directory.js';
export function browserFixture(db:AppDb,origin:string){const clock=fakeClock(Date.now()),directory=new FakeDirectory();const env=parseRuntimeEnv({DISCORD_TOKEN:'test-not-live',DISCORD_CLIENT_ID:ownerId,DISCORD_CLIENT_SECRET:'test-not-live',OWNER_DISCORD_ID:ownerId,DATABASE_URL:'postgresql://unused/test',DASHBOARD_REDIRECT_URI:origin+'/api/auth/discord/callback',SESSION_SECRET:'browser-test-session-at-least-32-characters',NODE_ENV:'test'});const oauth={authorizationUrl:(state:string)=>'/test-provider/authorize?state='+state,exchange:async(code:string)=>({id:code==='owner'?ownerId:'999999999999999999'})};const app=createHttpApp({env,db,clock,directory,oauth,logger:createLogger({write(){}}),status:{health:()=>({status:200,body:{status:'ok'}}),ready:()=>({status:200,body:{status:'ok'}})}});app.get('/test-provider/authorize',(req,res)=>{const state=encodeURIComponent(String(req.query.state));res.type('html').send('<h1>Injected OAuth provider</h1><a href="/api/auth/discord/callback?code=owner&state='+state+'">Continue as owner</a><a href="/api/auth/discord/callback?code=wrong&state='+state+'">Wrong owner</a>');});app.post('/test-provider/expire',async(_req,res)=>{await db.query('DELETE FROM owner_sessions');res.sendStatus(204);});registerDashboard(app,fileURLToPath(new URL('../../dashboard/dist',import.meta.url)));return {app,directory,clock};}

