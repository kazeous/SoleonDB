import type {Express,Request} from 'express';
import {z} from 'zod';
import {snowflakeSchema,isSettingsKey,settingsReferences} from '@eousbot/contracts';
import type {HttpDeps} from '../http/app.js';
import {createGuildService} from './service.js';
import {createSettingsService} from './settings.js';
import {sessionOwner} from '../auth/middleware.js';
import {AppError} from '../core/errors.js';
export function guildParam(req:Request):string {return snowflakeSchema.parse(req.params.guildId);}
export function registerGuildRoutes(app:Express,deps:HttpDeps):void {
  const guilds=createGuildService(deps.db,deps.directory);const settings=createSettingsService(deps.db,deps.clock);
  app.get('/api/guilds',async(req,res)=>res.json(await guilds.list(sessionOwner(req))));
  app.post('/api/guilds/:guildId/activate',async(req,res)=>res.json(await guilds.activate(sessionOwner(req),guildParam(req))));
  app.get('/api/guilds/:guildId',async(req,res)=>{
    const id=guildParam(req);await guilds.assertReadable(id);
    res.json((await guilds.list(sessionOwner(req))).find(g=>g.id===id));
  });
  app.get('/api/guilds/:guildId/channels',async(req,res)=>{const id=guildParam(req);await guilds.assertReadable(id);await guilds.assertEligible(sessionOwner(req),id);res.json(await guilds.syncChannels(id));});
  app.get('/api/guilds/:guildId/roles',async(req,res)=>{const id=guildParam(req);await guilds.assertReadable(id);await guilds.assertEligible(sessionOwner(req),id);res.json(await deps.directory.roles(id));});
  app.get('/api/guilds/:guildId/members/search',async(req,res)=>{
    const id=guildParam(req);await guilds.assertReadable(id);await guilds.assertEligible(sessionOwner(req),id);
    const query=z.string().trim().min(1).max(100).parse(req.query.q);
    res.json((await deps.directory.members(id,query,25)).filter(m=>m.guildId===id).slice(0,25));
  });
  app.get('/api/guilds/:guildId/settings/:feature',async(req,res)=>{
    const id=guildParam(req);await guilds.assertReadable(id);const key=req.params.feature;
    if(typeof key!=='string'||!isSettingsKey(key)) throw new AppError('validation','Unknown feature settings');
    res.json(await settings.read(id,key));
  });
  app.put('/api/guilds/:guildId/settings/:feature',async(req,res)=>{
    const id=guildParam(req);await guilds.assertGuildWrite(sessionOwner(req),id);const key=req.params.feature;
    if(typeof key!=='string'||!isSettingsKey(key)) throw new AppError('validation','Unknown feature settings');
    const body=z.strictObject({revision:z.number().int().min(0),value:z.unknown()}).parse(req.body);
    const value=await import('@eousbot/contracts').then(c=>c.settingsSchemas[key].parse(body.value));
    const channels=await guilds.syncChannels(id);
    const references=settingsReferences(key,value);
    if(references.channels.some(ref=>!channels.some(c=>c.guildId===id&&c.id===ref.id&&c.type===ref.type)))throw new AppError('validation','Select channels in this server');
    if(references.roleIds.length){const roles=await deps.directory.roles(id);if(references.roleIds.some(roleId=>!roles.some(r=>r.guildId===id&&r.id===roleId)))throw new AppError('validation','Select roles in this server');}
    for(const memberId of references.memberIds)if(!(await deps.directory.members(id,memberId,1)).some(m=>m.guildId===id&&m.id===memberId))throw new AppError('validation','Select members in this server');
    res.json(await settings.update(id,key,value,body.revision,sessionOwner(req)));
  });
}

