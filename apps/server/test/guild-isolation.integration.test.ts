import {it,expect} from 'vitest';
import {withTestDb,seedGuild} from './database.js';
import {createSettingsService} from '../src/guilds/settings.js';
import {createGuildRepository} from '../src/guilds/repository.js';
import {withTransaction} from '../src/db/client.js';
import {withMemberLock} from '../src/db/locks.js';
import {migrate} from '../src/db/migrate.js';
import {fakeClock} from './clock.js';
const a='9223372036854775807',b='9223372036854775808',owner='123456789012345678';
const defaults={enabled:false,logChannelId:null};
it('settings remain local and IDs round-trip as strings',()=>withTestDb(async db=>{
  await seedGuild(db,a);await seedGuild(db,b);
  const settings=createSettingsService(db,fakeClock(100));
  await settings.update(a,'moderation',{enabled:true,logChannelId:null},0,owner);
  expect(await settings.read(b,'moderation')).toEqual({revision:0,value:defaults});
  expect((await createGuildRepository(db).get(a))?.id).toBe(a);
  const audit=await db.query('SELECT guild_id,actor_id FROM configuration_audit');
  expect(audit.rows).toEqual([{guild_id:a,actor_id:owner}]);
}));
it('stale revision returns conflict and exactly one concurrent write succeeds',()=>withTestDb(async db=>{
  await seedGuild(db,a);await seedGuild(db,b);const settings=createSettingsService(db,fakeClock());
  await settings.update(a,'moderation',defaults,0,owner);
  const results=await Promise.allSettled([settings.update(a,'moderation',defaults,1,owner),settings.update(a,'moderation',defaults,1,owner)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.filter(r=>r.status==='rejected')).toEqual([expect.objectContaining({reason:expect.objectContaining({code:'conflict'})})]);
  expect((await settings.read(b,'moderation')).value).toEqual(defaults);
}));
it('cross-guild child reference is rejected by PostgreSQL',()=>withTestDb(async db=>{
  await seedGuild(db,a);await seedGuild(db,b);
  await db.query('INSERT INTO guild_channels(guild_id,id,name,type) VALUES($1,$2,$3,$4)',[a,'111111111111111111','logs','text']);
  await expect(db.query('INSERT INTO feature_settings(guild_id,feature,value,log_channel_id) VALUES($1,$2,$3,$4)',[b,'moderation',defaults,'111111111111111111'])).rejects.toMatchObject({code:'23503'});
}));
it('same member lock serializes concurrent callbacks',()=>withTestDb(async db=>{
  let inside=0,maximum=0;const completed:number[]=[];
  await Promise.all([1,2,3,4].map(i=>withTransaction(db,tx=>withMemberLock(tx,a,owner,async()=>{
    inside++;maximum=Math.max(maximum,inside);await tx.query('SELECT pg_sleep(0.01)');completed.push(i);inside--;
  }))));
  expect(maximum).toBe(1);expect(completed).toHaveLength(4);
}));
it('migrations are repeatable and unregistered settings reject',()=>withTestDb(async db=>{
  await migrate(db);await migrate(db);await seedGuild(db,a);const settings=createSettingsService(db,fakeClock());
  await expect(settings.read(a,'unregistered' as 'moderation')).rejects.toMatchObject({code:'validation'});
  await expect(settings.update(a,'moderation',{...defaults,secret:'no'} as typeof defaults,0,owner)).rejects.toMatchObject({code:'validation'});
}));

