import session from 'express-session';
import type {SessionData} from 'express-session';
import {createHash,randomBytes} from 'node:crypto';
import type {AppDb} from '../db/client.js';
import type {Clock} from '../core/clock.js';
import {unavailable} from '../core/errors.js';
declare module 'express-session' {
  interface SessionData { ownerId?:string;createdAt?:number;expiresAt?:number;csrfToken?:string;oauthStartedAt?:number }
}
export const sessionLifetimeMs=7*24*60*60*1000;
export const oauthLifetimeMs=10*60*1000;
export function opaqueToken():string {return randomBytes(32).toString('hex');}
export function hashToken(value:string):string {return createHash('sha256').update(value).digest('hex');}
export class PostgresSessionStore extends session.Store {
  constructor(private readonly db:AppDb,private readonly clock:Clock){super();}
  override get(sid:string,callback:(error:unknown,data?:SessionData|null)=>void):void {
    void this.db.query<{data:SessionData;expires_at:string}>('SELECT data,expires_at FROM owner_sessions WHERE id_hash=$1',[hashToken(sid)]).then(async result=>{
      const row=result.rows[0];
      if(!row || Number(row.expires_at)<=this.clock.now()) {
        if(row) await this.db.query('DELETE FROM owner_sessions WHERE id_hash=$1',[hashToken(sid)]);
        callback(null,null);return;
      }
      callback(null,row.data);
    }).catch(()=>callback(unavailable('Session storage unavailable')));
  }
  override set(sid:string,data:SessionData,callback?:(error?:unknown)=>void):void {
    const expiresAt=data.expiresAt??((data.oauthStartedAt??this.clock.now())+oauthLifetimeMs);
    void this.db.query('INSERT INTO owner_sessions(id_hash,data,expires_at) VALUES($1,$2,$3) ON CONFLICT(id_hash) DO UPDATE SET data=$2,expires_at=$3',[hashToken(sid),data,expiresAt]).then(()=>callback?.()).catch(()=>callback?.(unavailable('Session storage unavailable')));
  }
  override destroy(sid:string,callback?:(error?:unknown)=>void):void {
    void this.db.query('DELETE FROM owner_sessions WHERE id_hash=$1',[hashToken(sid)]).then(()=>callback?.()).catch(()=>callback?.(unavailable('Session storage unavailable')));
  }
  // Reading an authenticated session never extends its absolute lifetime.
  override touch(_sid:string,_data:SessionData,callback?:(error?:unknown)=>void):void {callback?.();}
}

