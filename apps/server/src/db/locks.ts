import type {AppTx} from './client.js';
const held=new WeakMap<AppTx,{guildId:string;members:Set<string>}>();
export async function withConfigLock<T>(tx:AppTx,guildId:string,fn:()=>Promise<T>):Promise<T> {
  const previous=held.get(tx);
  if(previous && previous.guildId!==guildId) throw new Error('One guild per locked transaction');
  if(!previous) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['guild-config:'+guildId]);
    held.set(tx,{guildId,members:new Set()});
  }
  return fn();
}
export async function withMemberLock<T>(tx:AppTx,guildId:string,userId:string,fn:()=>Promise<T>):Promise<T> {
  return withConfigLock(tx,guildId,async()=>{
    const state=held.get(tx)!;
    if(!state.members.has(userId)) {
      if([...state.members].some(id=>id>userId)) throw new Error('Acquire member locks in ID order');
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['member:'+guildId+':'+userId]);
      state.members.add(userId);
    }
    return fn();
  });
}

