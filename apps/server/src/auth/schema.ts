import {pgTable,text,jsonb,bigint,index} from 'drizzle-orm/pg-core';
import type {SessionData} from 'express-session';
export const ownerSessions=pgTable('owner_sessions',{
  idHash:text('id_hash').primaryKey(),data:jsonb('data').$type<SessionData>().notNull(),expiresAt:bigint('expires_at',{mode:'number'}).notNull(),
},t=>[index('sessions_expiry').on(t.expiresAt)]);
export const oauthStates=pgTable('oauth_states',{
  stateHash:text('state_hash').primaryKey(),sessionHash:text('session_hash').notNull(),expiresAt:bigint('expires_at',{mode:'number'}).notNull(),
},t=>[index('oauth_state_expiry').on(t.expiresAt)]);

