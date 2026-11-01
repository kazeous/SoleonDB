import type {Express,Request} from 'express';
import type {HttpDeps} from '../http/app.js';
import {requireOwner,requireCsrf} from './middleware.js';
import {hashToken,opaqueToken,sessionLifetimeMs,oauthLifetimeMs} from './sessions.js';
import {AppError} from '../core/errors.js';
function save(req:Request):Promise<void> {return new Promise((resolve,reject)=>req.session.save(error=>error?reject(error):resolve()));}
function destroy(req:Request):Promise<void> {return new Promise((resolve,reject)=>req.session.destroy(error=>error?reject(error):resolve()));}
export function registerAuthRoutes(app:Express,deps:HttpDeps):void {
  app.get('/api/auth/discord',async(req,res)=>{
    const state=opaqueToken();req.session.oauthStartedAt=deps.clock.now();await save(req);
    await deps.db.query('INSERT INTO oauth_states(state_hash,session_hash,expires_at) VALUES($1,$2,$3)',[hashToken(state),hashToken(req.sessionID),deps.clock.now()+oauthLifetimeMs]);
    res.redirect(deps.oauth.authorizationUrl(state));
  });
  app.get('/api/auth/discord/callback',async(req,res)=>{
    const {state,code}=req.query;
    if(typeof state!=='string'||!/^[a-f0-9]{64}$/.test(state)||typeof code!=='string'||!code||code.length>2048) throw new AppError('forbidden','Invalid or expired sign-in state');
    const consumed=await deps.db.query('DELETE FROM oauth_states WHERE state_hash=$1 AND session_hash=$2 AND expires_at>$3 RETURNING state_hash',[hashToken(state),hashToken(req.sessionID),deps.clock.now()]);
    if(consumed.rowCount!==1) throw new AppError('forbidden','Invalid or expired sign-in state');
    const identity=await deps.oauth.exchange(code);
    if(identity.id!==deps.env.ownerId){await destroy(req);throw new AppError('forbidden','This dashboard is available to its configured owner');}
    await new Promise<void>((resolve,reject)=>req.session.regenerate(error=>error?reject(error):resolve()));
    Object.assign(req.session,{ownerId:identity.id,createdAt:deps.clock.now(),expiresAt:deps.clock.now()+sessionLifetimeMs,csrfToken:opaqueToken()});
    req.session.cookie.maxAge=sessionLifetimeMs;await save(req);res.redirect('/');
  });
  app.get('/api/auth/me',requireOwner(deps),(req,res)=>res.json({owner:{id:req.session.ownerId},csrfToken:req.session.csrfToken}));
  app.post('/api/auth/logout',requireOwner(deps),requireCsrf(deps.env),async(req,res)=>{await destroy(req);res.clearCookie('eousbot.sid',{path:'/'});res.sendStatus(204);});
}

