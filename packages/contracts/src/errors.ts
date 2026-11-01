import { z } from 'zod';
export const apiErrorCodeSchema = z.enum(['validation','unauthorized','forbidden','not_found','conflict','unavailable']);
export const apiErrorSchema = z.strictObject({code:apiErrorCodeSchema,message:z.string(),fields:z.record(z.string(),z.string()).optional()});
export type ApiError = z.infer<typeof apiErrorSchema>;
export type Versioned<T> = { revision:number; value:T };

