import type {RequestHandler,Request} from 'express';
import {timingSafeEqual} from 'node:crypto';
import type {Clock} from '../core/clock.js';
import type {RuntimeEnv} from '../core/env.js';
import {AppError} from '../core/errors.js';
export function sessionOwner(req:Request):string {
  if(!req.session.ownerId) throw new AppError('unauthorized','Sign in to continue');
  return req.session.ownerId;
}
export function requireOwner(deps:{env:RuntimeEnv;clock:Clock}):RequestHandler {
  return (req,_res,next)=>{
    if(req.session?.ownerId!==deps.env.ownerId || !req.session.expiresAt || req.session.expiresAt<=deps.clock.now()) return next(new AppError('unauthorized','Sign in to continue'));
    next();
  };
}
export function requireCsrf(env:RuntimeEnv):RequestHandler {
  return (req,_res,next)=>{
    if(['GET','HEAD','OPTIONS'].includes(req.method)) return next();
    const expected=req.session.csrfToken;const actual=req.get('x-csrf-token');const origin=req.get('origin');
    if(origin && origin!==new URL(env.redirectUri).origin) return next(new AppError('forbidden','Invalid request origin'));
    if(!expected || !actual || expected.length!==actual.length || !timingSafeEqual(Buffer.from(expected),Buffer.from(actual))) return next(new AppError('forbidden','Invalid CSRF token'));
    next();
  };
}

