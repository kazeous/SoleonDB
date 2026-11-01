export interface PruningScheduler { register(name:string,intervalMs:number,run:()=>Promise<void>):()=>void }
export function registerPruning(scheduler:PruningScheduler,pruners:Array<(limit:number)=>Promise<void>>):()=>void {
  return scheduler.register('expired-record-pruning',60000,async()=>{
    for(const prune of pruners) await prune(1000);
  });
}
