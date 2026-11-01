import {Alert,AlertTitle,AlertDescription} from './ui/alert';
import {Badge} from './ui/badge';
import type {FeatureState} from '@eousbot/contracts';
export function FeatureStatus({state,reason}:{state:FeatureState;reason:string}){return <Alert><AlertTitle><Badge variant="outline">{{disabled:'Disabled',needs_setup:'Needs setup',ready:'Ready',degraded:'Degraded'}[state]}</Badge></AlertTitle><AlertDescription>{reason}</AlertDescription></Alert>;}
