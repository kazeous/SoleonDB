import { z } from 'zod';
export const featureKeySchema = z.enum(['moderation','automod','verification','roles','voice','starboard','suggestions','threads','greetings','social','feeds','productivity']);
export const featureStateSchema = z.enum(['disabled','needs_setup','ready','degraded']);
export type FeatureKey = z.infer<typeof featureKeySchema>;
export type FeatureState = z.infer<typeof featureStateSchema>;
export interface FeatureModule { key:FeatureKey; start():Promise<void>; stop():Promise<void> }

