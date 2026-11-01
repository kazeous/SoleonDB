import {z} from 'zod';
import {snowflakeSchema} from './ids.js';
export const suggestionStatusSchema=z.enum(['voting','approved','rejected','in_progress','implemented']);
export type SuggestionStatus=z.infer<typeof suggestionStatusSchema>;
export const suggestionInputSchema=z.strictObject({title:z.string().trim().min(1).max(240),description:z.string().trim().min(1).max(3500)});
export type SuggestionInput=z.infer<typeof suggestionInputSchema>;
export const suggestionsConfigSchema=z.strictObject({enabled:z.boolean(),channelId:snowflakeSchema.nullable(),discussionThreads:z.boolean()}).refine(value=>!value.enabled||value.channelId!==null,'Select a destination channel');
export const suggestionsDefaults={enabled:false,channelId:null,discussionThreads:true} satisfies z.infer<typeof suggestionsConfigSchema>;
