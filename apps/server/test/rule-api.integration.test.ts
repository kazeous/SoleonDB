import {it,expect} from 'vitest';
import {withTestDb} from './database.js';
import {httpFixture} from './http-fixtures.js';
import {guildA,guildB} from './directory.js';
const input={name:' Link flood ',channelId:'111111111111111111',enabled:true,trigger:{kind:'link'},threshold:{count:3,windowSeconds:10},action:{kind:'timeout',durationSeconds:3600},exemptUserIds:[],exemptRoleIds:[]};
it('creates local rules, rejects foreign IDs and stale revisions, audits disable/delete',()=>withTestDb(async db=>{
 const f=httpFixture(db);await f.login();const token=await f.csrf();await f.agent.get('/api/guilds').expect(200);for(const guild of [guildA,guildB])await f.agent.post('/api/guilds/'+guild+'/activate').set('x-csrf-token',token).expect(200);
 const path='/api/guilds/'+guildA+'/channel-rules';
 const created=(await f.agent.post(path).set('x-csrf-token',token).send(input).expect(201)).body;
 expect(created.name).toBe('Link flood');expect(created.overridesGeneralAutoMod).toBe(true);expect(created.revision).toBe(1);
 await f.agent.get('/api/guilds/'+guildB+'/channel-rules/'+created.id).expect(404);
 await f.agent.post(path).set('x-csrf-token',token).send({...input,channelId:'222222222222222222'}).expect(400);
 await f.agent.post(path).set('x-csrf-token',token).send({...input,exemptUserIds:['999999999999999999']}).expect(400);
 await f.agent.post(path).set('x-csrf-token',token).send({...input,token:'secret'}).expect(400);
 const paused=(await f.agent.put(path+'/'+created.id).set('x-csrf-token',token).send({revision:1,value:{...input,enabled:false}}).expect(200)).body;
 expect(paused.overridesGeneralAutoMod).toBe(false);expect(paused.revision).toBe(2);
 await f.agent.put(path+'/'+created.id).set('x-csrf-token',token).send({revision:1,value:input}).expect(409);
 await f.agent.delete(path+'/'+created.id).set('x-csrf-token',token).send({revision:2}).expect(204);
 expect((await f.agent.get(path).expect(200)).body).toEqual([]);expect((await db.query('SELECT 1 FROM configuration_audit WHERE guild_id=$1',[guildA])).rowCount).toBe(3);
}));

