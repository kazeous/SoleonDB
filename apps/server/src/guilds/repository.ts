import {eq} from 'drizzle-orm';
import type {GuildSummary} from '@eousbot/contracts';
import {snowflakeSchema} from '@eousbot/contracts';
import type {AppDb} from '../db/client.js';
import {guilds} from './schema.js';
export function createGuildRepository(db:AppDb) {
  return {
    async activate(guildId:string):Promise<void> {
      snowflakeSchema.parse(guildId);
      await db.orm.insert(guilds).values({id:guildId,active:true}).onConflictDoUpdate({target:guilds.id,set:{active:true}});
    },
    async get(guildId:string):Promise<GuildSummary|null> {
      const [row]=await db.orm.select().from(guilds).where(eq(guilds.id,guildId));
      return row ? {id:row.id,name:row.name,iconUrl:row.iconUrl,active:row.active,eligible:false} : null;
    },
  };
}

