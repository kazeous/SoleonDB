import type {Express} from 'express';
import {z} from 'zod';
import {snowflakeSchema,caseActionSchema,caseSourceSchema,caseOutcomeStateSchema,caseFilterSchema} from '@eousbot/contracts';
import type {HttpDeps} from '../../http/app.js';
import {guildParam} from '../../guilds/routes.js';
import {createGuildService} from '../../guilds/service.js';
import {createCaseRepository} from './cases.js';
import {AppError} from '../../core/errors.js';
const dateQuery=z.string().transform((value,context)=>{const numeric=/^[0-9]+$/.test(value)?Number(value):z.iso.datetime({offset:true}).safeParse(value).success?Date.parse(value):NaN;if(!Number.isSafeInteger(numeric)||numeric<0){context.addIssue({code:'custom',message:'Invalid date'});return z.NEVER;}return numeric;});
const querySchema=z.strictObject({memberId:snowflakeSchema.optional(),action:caseActionSchema.optional(),source:caseSourceSchema.optional(),outcome:caseOutcomeStateSchema.optional(),from:dateQuery.optional(),to:dateQuery.optional(),cursor:z.string().max(1024).optional(),limit:z.coerce.number().int().min(1).max(100).default(25)});
export function registerCaseRoutes(app:Express,deps:HttpDeps):void {
 const cases=createCaseRepository(deps.db),guilds=createGuildService(deps.db,deps.directory),root='/api/guilds/:guildId/cases';
 app.get(root,async(req,res)=>{const guildId=guildParam(req);await guilds.assertReadable(guildId);const {cursor,limit,...filter}=querySchema.parse(req.query);res.json(await cases.list(guildId,caseFilterSchema.parse(filter),cursor??null,limit));});
 app.get(root+'/:caseId',async(req,res)=>{const guildId=guildParam(req);await guilds.assertReadable(guildId);const value=await cases.get(guildId,z.uuid().parse(req.params.caseId));if(!value)throw new AppError('not_found','Case not found in this server');res.json(value);});
}

