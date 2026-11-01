import {it,expect} from 'vitest';
import {assertCommandAuthority,registerModerationCommands} from '../src/features/moderation/commands.js';
import type {CommandAuthoritySnapshot} from '../src/features/moderation/commands.js';
import {selectCleanMessages} from '../src/features/moderation/clean.js';
import {createCommandRouter} from '../src/discord/interactions.js';
const authority:CommandAuthoritySnapshot={guildId:'9223372036854775807',actorId:'123456789012345678',targetId:'222222222222222222',ownerId:'999999999999999999',botId:'888888888888888888',actorPermissions:'0',actorPosition:5,botPosition:10,targetPosition:1};
it.each([['warn','2'],['cases','2'],['kick','2'],['timeout','1099511627776'],['ban','4'],['clean','8192']] as const)('%s requires its current Discord permission', (command,permission)=>{
 expect(()=>assertCommandAuthority(command,authority)).toThrow();expect(()=>assertCommandAuthority(command,{...authority,actorPermissions:permission})).not.toThrow();
});
it.each([{targetId:authority.actorId},{targetId:authority.botId},{targetId:authority.ownerId},{targetPosition:5},{targetPosition:10}])('rejects unsafe target or hierarchy %o',patch=>expect(()=>assertCommandAuthority('ban',{...authority,actorPermissions:'4',...patch})).toThrow());
it('owner may outrank the actor hierarchy but bot hierarchy still applies',()=>{
 expect(()=>assertCommandAuthority('kick',{...authority,actorId:authority.ownerId,targetPosition:7})).not.toThrow();expect(()=>assertCommandAuthority('kick',{...authority,actorId:authority.ownerId,targetPosition:10})).toThrow();
});
it('cleanup filters and author restrictions report selected versus skipped, including old messages',()=>{
 const now=2000000000000,base={guildId:authority.guildId,channelId:'111111111111111111',authorId:authority.targetId!,bot:false,content:'plain',createdAt:now,attachmentCount:0,embedCount:0};
 const messages=[{...base,id:'1'},{...base,id:'2',bot:true},{...base,id:'3',content:'https://example.org'},{...base,id:'4',content:'discord.gg/hello'},{...base,id:'5',attachmentCount:1},{...base,id:'6',createdAt:now-14*86400000-1}];
 for(const [filter,ids] of [['only-bots',['2']],['only-users',['1','3','4','5']],['contain-links',['3','4']],['contain-invites',['4']],['text-only',['1','2','3','4']]] as const)expect(selectCleanMessages(messages,{amount:100,filter},now).selected.map(m=>m.id)).toEqual(ids);
 expect(selectCleanMessages(messages,{amount:100,userId:'444444444444444444'},now)).toMatchObject({selected:[],skipped:6});
});
it('malformed timeout options return clear deferred errors and cases always use the context guild',async()=>{
 const router=createCommandRouter([]);let readGuild='',requested=0;const output:string[]=[];
 registerModerationCommands(router,{authority:{async inspect(guildId,actorId,targetId){return {...authority,guildId,actorId,targetId,actorPermissions:'1099511627778'};}},actions:{async request(){requested++;return {number:1,outcome:{state:'succeeded'}} as never;}},cases:{async list(guildId){readGuild=guildId;return {items:[],nextCursor:null};}} as never,clean:{async run(){return {deleted:0,skipped:0,failed:0,caseNumber:1};}}});
 function input(name:string,options:Record<string,unknown>){return {id:name,name,kind:'command' as const,guildId:authority.guildId,channelId:'111111111111111111',userId:authority.actorId,member:{id:authority.actorId,guildId:authority.guildId,displayName:'Moderator',roleIds:[],permissions:'1099511627778'},options,async defer(){output.push('defer');},async reply(text:string){output.push(text);},async edit(text:string){output.push(text);}};}
 await router.dispatch(input('timeout',{user:authority.targetId,duration:0}));expect(output[0]).toBe('defer');expect(output.at(-1)).toMatch(/duration|minutes/i);expect(requested).toBe(0);
 await router.dispatch(input('cases',{user:authority.targetId}));expect(readGuild).toBe(authority.guildId);
});

