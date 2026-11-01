import type {Express} from 'express';
import {z} from 'zod';
import {ruleInputSchema} from '@eousbot/contracts';
import type {ChannelRule} from '@eousbot/contracts';
import type {HttpDeps} from '../../http/app.js';
import {sessionOwner} from '../../auth/middleware.js';
import {createGuildService} from '../../guilds/service.js';
import {guildParam} from '../../guilds/routes.js';
import {createRuleService} from './service.js';
import {createRuleRepository} from './repository.js';
import {AppError} from '../../core/errors.js';
function response(rule:ChannelRule){return {...rule,overridesGeneralAutoMod:rule.enabled};}
export function registerProtectionRoutes(app:Express,deps:HttpDeps):void {
 const service=createRuleService(deps.db,deps.clock,deps.directory),guilds=createGuildService(deps.db,deps.directory),repository=createRuleRepository(deps.db);
 const root='/api/guilds/:guildId/channel-rules';
 app.get(root,async(req,res)=>{const id=guildParam(req);await guilds.assertReadable(id);res.json((await service.list(id)).map(response));});
 app.get(root+'/:id',async(req,res)=>{const guildId=guildParam(req);await guilds.assertReadable(guildId);const rule=await repository.current(deps.db,guildId,z.uuid().parse(req.params.id));if(!rule)throw new AppError('not_found','Rule not found in this server');res.json(response(rule));});
 app.post(root,async(req,res)=>{const id=guildParam(req);await guilds.assertGuildWrite(sessionOwner(req),id);res.status(201).json(response(await service.create(id,ruleInputSchema.parse(req.body),sessionOwner(req))));});
 app.put(root+'/:id',async(req,res)=>{const id=guildParam(req);await guilds.assertGuildWrite(sessionOwner(req),id);const body=z.strictObject({revision:z.number().int().min(1),value:ruleInputSchema}).parse(req.body);res.json(response(await service.update(id,z.uuid().parse(req.params.id),body.value,body.revision,sessionOwner(req))));});
 app.delete(root+'/:id',async(req,res)=>{const id=guildParam(req);await guilds.assertGuildWrite(sessionOwner(req),id);const body=z.strictObject({revision:z.number().int().min(1)}).parse(req.body);await service.remove(id,z.uuid().parse(req.params.id),body.revision,sessionOwner(req));res.sendStatus(204);});
}

