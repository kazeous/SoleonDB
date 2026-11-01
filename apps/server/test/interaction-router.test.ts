import {it,expect} from 'vitest';
import {createCommandRouter} from '../src/discord/interactions.js';
import type {CommandContext} from '../src/discord/interactions.js';
import {createMessagePipeline} from '../src/discord/messages.js';
function context(overrides:Partial<CommandContext>={}):CommandContext {
 return {id:'interaction-1',name:'slow',kind:'command',guildId:'9223372036854775807',channelId:'111111111111111111',userId:'123456789012345678',member:{id:'123456789012345678',guildId:'9223372036854775807',displayName:'Member',roleIds:[],permissions:'0'},options:{},async reply(){},async defer(){},async edit(){},...overrides};
}
it('deduplicates concurrent interaction IDs and defers before handler work',async()=>{
 const events:string[]=[];const router=createCommandRouter([{kind:'command',name:'slow',handler:async()=>{events.push('work');}}]);
 const input=context({async defer(){events.push('defer');}});await Promise.all([router.dispatch(input),router.dispatch(input)]);expect(events).toEqual(['defer','work']);
});
it.each([{guildId:null},{member:null},{userId:null}])('rejects incomplete guild/member payload %o',async missing=>{
 let invoked=false;let reply='';const router=createCommandRouter([{kind:'command',name:'slow',handler:async()=>{invoked=true;}}]);
 await router.dispatch(context({...missing,async reply(text){reply=text;}}));expect(invoked).toBe(false);expect(reply).toMatch(/server|member/i);
});
it('routes namespaces once and reports errors after defer',async()=>{
 const events:string[]=[];const router=createCommandRouter([{kind:'component',name:'roles',handler:async()=>{throw new Error('secret internal error');}}]);
 await router.dispatch(context({kind:'component',name:'roles:panel:role',async defer(){events.push('defer');},async edit(text){events.push(text);}}));
 expect(events[0]).toBe('defer');expect(events[1]).toMatch(/failed/i);expect(events[1]).not.toContain('secret');
});
it('held disposition persists and deletion stops downstream effects',async()=>{
 let calls=0;const pipeline=createMessagePipeline([async()=>({kind:'held'}),async(_message,disposition)=>{expect(disposition?.kind).toBe('held');return {kind:'delete'};},async()=>{calls++;return {kind:'allow'};}]);
 expect(await pipeline({} as never)).toEqual({kind:'delete'});expect(calls).toBe(0);
});

