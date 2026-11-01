import type {FeatureKey,FeatureState} from '@eousbot/contracts';
import type {Clock} from './clock.js';
export function createStatus(clock:Clock) {
  let initialized=false,draining=false,fatal=false,worker=false,discord=false,schema=false;
  let probe:{ok:boolean;at:number}|null=null;
  const health=()=>{const live=initialized&&!draining&&!fatal;return {status:live?200:503,body:{status:live?'ok':'not_ready'}};};
  const dependenciesHealthy=()=>schema&&probe!==null&&probe.ok&&clock.now()-probe.at>=0&&clock.now()-probe.at<=10000;
  return {
    health,
    ready(){const ready=health().status===200&&worker&&discord&&dependenciesHealthy();return {status:ready?200:503,body:{status:ready?'ok':'not_ready'}};},
    setInitialized(value:boolean){initialized=value;},setDraining(value:boolean){draining=value;},setFatal(value:boolean){fatal=value;},
    setWorker(value:boolean){worker=value;},setDiscord(value:boolean){discord=value;},setSchema(value:boolean){schema=value;},
    recordProbe(ok:boolean){probe={ok,at:clock.now()};},dependenciesHealthy,
    snapshot(){return {initialized,draining,fatal,worker,discord,schema,probe:probe?{...probe}:null};},
  };
}
export type RuntimeStatus=ReturnType<typeof createStatus>;
export interface FeatureDiagnostic {key:FeatureKey;state:FeatureState;reason?:string;lastSuccessAt:number|null}
export class FeatureStatusRegistry {
  private readonly guilds=new Map<string,Map<FeatureKey,FeatureDiagnostic>>();
  constructor(private readonly clock:Clock){}
  set(guildId:string,key:FeatureKey,state:FeatureState,reason?:string):void {
    const entries=this.guilds.get(guildId)??new Map<FeatureKey,FeatureDiagnostic>();
    entries.set(key,{key,state,...(reason?{reason}:{}),lastSuccessAt:state==='ready'?this.clock.now():entries.get(key)?.lastSuccessAt??null});this.guilds.set(guildId,entries);
  }
  list(guildId:string):FeatureDiagnostic[]{return [...(this.guilds.get(guildId)?.values()??[])].map(entry=>({...entry}));}
}
export function checkRequiredIntents(registry:FeatureStatusRegistry,guildId:string,available:{messageContent:boolean;presence:boolean},requirements:Array<{key:FeatureKey;messageContent?:boolean;presence?:boolean}>):void {
  for(const requirement of requirements) {
    if(requirement.messageContent&&!available.messageContent) registry.set(guildId,requirement.key,'degraded','Enable the Message Content intent in the application and Discord developer portal.');
    else if(requirement.presence&&!available.presence) registry.set(guildId,requirement.key,'degraded','Enable Guild Presences to use the current-game voice control.');
  }
}

