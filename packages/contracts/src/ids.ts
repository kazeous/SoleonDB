import { z } from 'zod';
// IDs remain decimal strings through JSON, SQL and browser boundaries.
export const snowflakeSchema = z.string().regex(/^[1-9][0-9]{0,19}$/)
  .refine(value => /^[1-9][0-9]{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n, 'Invalid Discord ID');
export type GuildId = string;
export type UserId = string;
export type ChannelId = string;
export type RoleId = string;
export type MessageId = string;

