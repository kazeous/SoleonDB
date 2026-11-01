import {browserDiagnostics} from './browser-diagnostics.js';
import {createSettingsService} from '../src/guilds/settings.js';
import {createRuleRepository} from '../src/features/protection/repository.js';
import {createProtectionEngine} from '../src/features/protection/engine.js';
import {createEnforcementService} from '../src/features/moderation/enforcement.js';
import {FakeModerationPort} from './moderation-port.js';
import {message} from './message.js';
import {fileURLToPath} from 'node:url';
import {createHttpApp} from '../src/http/app.js';
import {registerDashboard} from '../src/http/dashboard.js';
import {parseRuntimeEnv} from '../src/core/env.js';
import {createLogger} from '../src/core/logger.js';
import type {AppDb} from '../src/db/client.js';
import {fakeClock} from './clock.js';
import {FakeDirectory,ownerId} from './directory.js';
export function browserFixture(db:AppDb,origin:string){const clock=fakeClock(Date.now()),directory=new FakeDirectory();directory.channelData.push({id:'777777777777777777',guildId:'9223372036854775807',name:'Join to create',type:'voice'});directory.roleData=[{id:'666666666666666666',guildId:'9223372036854775807',name:'Verified',position:2,managed:false,permissions:'0'},{id:'333333333333333333',guildId:'9223372036854775807',name:'Trusted',position:1,managed:false,permissions:'0'}];directory.memberData=[{id:'444444444444444444',guildId:'9223372036854775807',displayName:'Alice',roleIds:[],permissions:'0'}];const env=parseRuntimeEnv({DISCORD_TOKEN:'test-not-live',DISCORD_CLIENT_ID:ownerId,DISCORD_CLIENT_SECRET:'test-not-live',OWNER_DISCORD_ID:ownerId,DATABASE_URL:'postgresql://unused/test',DASHBOARD_REDIRECT_URI:origin+'/api/auth/discord/callback',SESSION_SECRET:'browser-test-session-at-least-32-characters',OPENAI_API_KEY:'browser-test-not-live',OPENAI_SUMMARY_MODEL:'explicit-test-model',NODE_ENV:'test'});const oauth={authorizationUrl:(state:string)=>'/test-provider/authorize?state='+state,exchange:async(code:string)=>({id:code==='owner'?ownerId:'999999999999999999'})};const diagnostics=browserDiagnostics(db,clock);const app=createHttpApp({inspection:diagnostics.inspection,env,db,clock,directory,oauth,logger:createLogger({write(){}}),status:diagnostics.status});diagnostics.register(app);app.get('/test-provider/authorize',(req,res)=>{const state=encodeURIComponent(String(req.query.state));res.type('html').send('<h1>Injected OAuth provider</h1><a href="/api/auth/discord/callback?code=owner&state='+state+'">Continue as owner</a><a href="/api/auth/discord/callback?code=wrong&state='+state+'">Wrong owner</a>');});app.post('/test-provider/expire',async(_req,res)=>{await db.query('DELETE FROM owner_sessions');res.sendStatus(204);});const port=new FakeModerationPort(db),enforcement=createEnforcementService({db,clock,port,related:{list:async()=>[]}});app.post('/test-provider/queue/:ruleId',async(req,res)=>{const rule=await createRuleRepository(db).current(db,'9223372036854775807',String(req.params.ruleId));if(!rule){res.sendStatus(404);return;}const engine=createProtectionEngine(db,clock);for(let i=0;i<rule.threshold.count;i++)await engine.observe(message({id:String(555555555555555000n+BigInt(i)),guildId:rule.guildId,channelId:rule.channelId,createdAt:clock.now(),content:'Unformatted plain text'}));res.sendStatus(204);});app.post('/test-provider/drain',async(_req,res)=>{const rows=await db.query<{id:string}>("SELECT id FROM moderation_incidents WHERE state='pending'");for(const row of rows.rows)await enforcement.dispatch(row.id);res.json(port.calls);});app.post('/test-provider/deleted-role',async(_req,res)=>{const settings=createSettingsService(db,clock),snapshot=await settings.read('9223372036854775807','verification');await settings.update('9223372036854775807','verification',{...snapshot.value,enabled:false,channelId:'111111111111111111',roleId:'999999999999999998'},snapshot.revision,ownerId);res.sendStatus(204);});registerDashboard(app,fileURLToPath(new URL('../../dashboard/dist',import.meta.url)));return {app,directory,clock};}






