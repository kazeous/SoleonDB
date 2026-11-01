import type {RuntimeEnv} from '../core/env.js';
import {snowflakeSchema} from '@eousbot/contracts';
import {unavailable} from '../core/errors.js';
export interface OAuthPort { authorizationUrl(state:string):string;exchange(code:string):Promise<{id:string}> }
export function createOAuth(env:RuntimeEnv):OAuthPort {
  return {
    authorizationUrl(state){
      const url=new URL('https://discord.com/oauth2/authorize');
      url.search=new URLSearchParams({client_id:env.clientId,redirect_uri:env.redirectUri,response_type:'code',scope:'identify',state}).toString();return url.href;
    },
    async exchange(code){
      try {
        const signal=AbortSignal.timeout(10000);
        const response=await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.clientId,client_secret:env.clientSecret,grant_type:'authorization_code',code,redirect_uri:env.redirectUri}),signal,redirect:'error'});
        if(!response.ok) throw unavailable();
        const token:unknown=await response.json();
        if(!token || typeof token!=='object' || !('access_token' in token) || typeof token.access_token!=='string') throw unavailable();
        const identity=await fetch('https://discord.com/api/v10/users/@me',{headers:{authorization:'Bearer '+token.access_token},signal,redirect:'error'});
        if(!identity.ok) throw unavailable();
        const user:unknown=await identity.json();
        if(!user || typeof user!=='object' || !('id' in user)) throw unavailable();
        return {id:snowflakeSchema.parse(user.id)};
      } catch {throw unavailable('Discord sign-in unavailable. Please retry.');}
    },
  };
}

