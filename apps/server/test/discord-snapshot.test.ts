import {it,expect} from 'vitest';
import {extractExplicitMentions} from '../src/discord/client.js';
import {parseCommandTargets} from '../src/discord/deploy-commands.js';
it('mentions are extracted from raw text rather than automatic reply metadata',()=>{
 expect(extractExplicitMentions('hello <@123456789012345678> <@!123456789012345678> <@&222222222222222222> @here')).toEqual({userIds:['123456789012345678'],roleIds:['222222222222222222'],everyone:true});
 expect(extractExplicitMentions('a plain reply')).toEqual({userIds:[],roleIds:[],everyone:false});
});
it('command deployment requires an exact guild string or deliberate activated scope',()=>{
 expect(parseCommandTargets(['--guild','9223372036854775807'])).toEqual({guildId:'9223372036854775807'});
 expect(parseCommandTargets(['--activated-guilds'])).toEqual({activated:true});
 for(const args of [[],['--global'],['--guild','invalid'],['--guild','1','--activated-guilds']]) expect(()=>parseCommandTargets(args)).toThrow();
});

it('acknowledges SDK interaction before fetching current member data',async()=>{
 const {interactionContext}=await import('../src/discord/client.js');const events:string[]=[];
 const user={id:'123456789012345678'};const guild={id:'9223372036854775807',members:{async fetch(){events.push('member-fetch');return {id:user.id,displayName:'Member',roles:{cache:new Map()},permissions:{bitfield:0n}};}}};
 const interaction={id:'interaction',guild,guildId:guild.id,channelId:'111111111111111111',user,commandName:'example',options:{data:[]},deferred:false,replied:false,isRepliable:()=>true,isChatInputCommand:()=>true,isContextMenuCommand:()=>false,isAnySelectMenu:()=>false,isModalSubmit:()=>false,async deferReply(){events.push('defer');this.deferred=true;},async reply(){},async editReply(){}};
 await interactionContext(interaction as unknown as import('discord.js').Interaction);expect(events).toEqual(['defer','member-fetch']);
});
