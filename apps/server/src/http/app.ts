import {registerFeedStatusRoutes} from '../features/feeds/routes.js';
import express from 'express';
import {registerCaseRoutes} from '../features/moderation/routes.js';
import {registerProtectionRoutes} from '../features/protection/routes.js';
import {registerHealthRoutes} from './health.js';
import type {Express} from 'express';
import session from 'express-session';
import type {RuntimeEnv} from '../core/env.js';
import type {AppDb} from '../db/client.js';
import type {Clock} from '../core/clock.js';
import type {Logger} from '../core/logger.js';
import type {GuildDirectory} from '../guilds/ports.js';
import type {OAuthPort} from '../auth/oauth.js';
import {PostgresSessionStore} from '../auth/sessions.js';
import {requireOwner,requireCsrf} from '../auth/middleware.js';
import {registerAuthRoutes} from '../auth/routes.js';
import {registerGuildRoutes} from '../guilds/routes.js';
import {errorHandler} from './error-handler.js';
import {AppError} from '../core/errors.js';
export interface HealthReader {health():{status:number;body:unknown};ready():{status:number;body:unknown}}
export interface HttpDeps {env:RuntimeEnv;db:AppDb;clock:Clock;logger:Logger;directory:GuildDirectory;oauth:OAuthPort;status:HealthReader}
export function createHttpApp(deps:HttpDeps):Express {
  const app=express();app.disable('x-powered-by');app.set('trust proxy',deps.env.trustedProxyCidrs);
  app.use((_req,res,next)=>{
    res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'"});next();
  });
  // Probes must remain independent of session/DB middleware.
  registerHealthRoutes(app,deps.status);
  app.use('/api',express.json({limit:'64kb'}));
  app.use('/api',session({name:'eousbot.sid',secret:deps.env.sessionSecret,store:new PostgresSessionStore(deps.db,deps.clock),resave:false,saveUninitialized:false,rolling:false,cookie:{httpOnly:true,sameSite:'lax',secure:deps.env.nodeEnv==='production',path:'/'}}));
  app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  registerAuthRoutes(app,deps);
  app.use('/api',requireOwner(deps),requireCsrf(deps.env));
  registerGuildRoutes(app,deps);
  registerFeedStatusRoutes(app,deps);
  registerProtectionRoutes(app,deps);
  registerCaseRoutes(app,deps);
  app.use('/api',()=>{throw new AppError('not_found','API route not found');});
  app.use(errorHandler(deps.logger));
  return app;
}


