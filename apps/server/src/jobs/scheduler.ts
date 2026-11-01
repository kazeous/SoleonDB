import type {Logger} from '../core/logger.js';
export interface Scheduler {register(name:string,intervalMs:number,run:()=>Promise<void>):()=>void;stop():Promise<void>}
export function createScheduler(logger:Logger):Scheduler {
  const jobs=new Map<string,{timer:ReturnType<typeof setInterval>;pending:Promise<void>|null}>();
  const running=new Set<Promise<void>>();
  const runningNames=new Set<string>();
  return {
    register(name,intervalMs,run){
      if(jobs.has(name)||runningNames.has(name)||!Number.isFinite(intervalMs)||intervalMs<1) throw new Error('Invalid or duplicate scheduled job');
      const entry={timer:undefined as unknown as ReturnType<typeof setInterval>,pending:null as Promise<void>|null};
      entry.timer=setInterval(()=>{
        if(entry.pending) return;
        runningNames.add(name);
        entry.pending=Promise.resolve().then(run).catch(()=>{logger.error({job:name},'Scheduled job failed');}).finally(()=>{if(entry.pending)running.delete(entry.pending);entry.pending=null;runningNames.delete(name);});
        running.add(entry.pending);
      },intervalMs);
      jobs.set(name,entry);
      return ()=>{clearInterval(entry.timer);jobs.delete(name);};
    },
    async stop(){const pending=[...jobs.values()];for(const job of pending)clearInterval(job.timer);jobs.clear();await Promise.all([...running]);},
  };
}

