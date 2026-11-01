import {it,expect} from 'vitest';
import {ruleInputSchema} from '@eousbot/contracts';
import type {ChannelRule,RuleInput} from '@eousbot/contracts';
import {matchesRule} from '../src/features/protection/matcher.js';
import {message} from './message.js';
const base:RuleInput={name:'Protection',channelId:'111111111111111111',enabled:true,trigger:{kind:'any'},threshold:{count:3,windowSeconds:10},action:{kind:'timeout',durationSeconds:3600},exemptUserIds:[],exemptRoleIds:[]};
function rule(patch:Partial<RuleInput>={}):ChannelRule{return {...base,...patch,id:'b5ca3fc7-13b3-4bbd-bf4c-5ee894c88f9b',guildId:'9223372036854775807',revision:1};}
it.each(['https://example.org/a','[offer](https://example.org/a)','www.example.com','example.org/a','discord.gg/hello'])('matches local link text %s',content=>expect(matchesRule(rule({trigger:{kind:'link'}}),message({content}))).toBe(true));
it.each(['plain text','user@example.org','ftp://example.org/file'])('does not classify %s as HTTP link',content=>expect(matchesRule(rule({trigger:{kind:'link'}}),message({content}))).toBe(false));
it.each(['<@123456789012345678>','<@&222222222222222222>','@everyone','@here'])('detects explicit mention %s',content=>expect(matchesRule(rule({trigger:{kind:'mention',users:true,roles:true,everyone:true}}),message({content}))).toBe(true));
it('ignores automatic reply mentions and disabled mention categories',()=>{
 expect(matchesRule(rule({trigger:{kind:'mention',users:true,roles:true,everyone:true}}),message({mentions:{userIds:[],roleIds:[],everyone:false,replyAuthorId:'999999999999999999'}}))).toBe(false);
 expect(matchesRule(rule({trigger:{kind:'mention',users:false,roles:true,everyone:false}}),message({content:'<@123456789012345678> @here'}))).toBe(false);
});
it('photos use MIME with filename fallback, never a linked preview or known video',()=>{
 const photo=rule({trigger:{kind:'photo'}});
 for(const attachment of [{id:'1',contentType:'image/gif',name:'animation.bin'},{id:'1',contentType:null,name:'IMAGE.PNG'}])expect(matchesRule(photo,message({attachments:[attachment]}))).toBe(true);
 expect(matchesRule(photo,message({content:'https://example.org/a.png'}))).toBe(false);
 expect(matchesRule(photo,message({attachments:[{id:'1',contentType:'video/mp4',name:'file.png'}]}))).toBe(false);
});
it('inspects administrators and only explicit exemptions bypass matching',()=>{
 expect(matchesRule(rule(),message({member:{roleIds:[],permissions:'8',highestRolePosition:99,displayName:'Admin'}}))).toBe(true);
 expect(matchesRule(rule({exemptUserIds:['123456789012345678']}),message())).toBe(false);
 expect(matchesRule(rule({exemptRoleIds:['222222222222222222']}),message({member:{roleIds:['222222222222222222'],permissions:'0',highestRolePosition:1,displayName:'Member'}}))).toBe(false);
});
it.each([{authorKind:'bot'},{authorKind:'webhook'},{guildId:'9223372036854775808'},{channelId:'222222222222222222'},{isThread:true}])('ignores non-local human-channel payload %o',patch=>expect(matchesRule(rule(),message(patch as Partial<ReturnType<typeof message>>))).toBe(false));
it('partial data produces unavailable rather than a clean result',()=>expect(()=>matchesRule(rule(),message({partial:true}))).toThrow());
it.each([0,101])('rejects count %s',count=>expect(ruleInputSchema.safeParse({...base,threshold:{count,windowSeconds:10}}).success).toBe(false));
it.each([0,3601])('rejects window %s',windowSeconds=>expect(ruleInputSchema.safeParse({...base,threshold:{count:3,windowSeconds}}).success).toBe(false));
it.each([59,2419201])('rejects timeout %s',durationSeconds=>expect(ruleInputSchema.safeParse({...base,action:{kind:'timeout',durationSeconds}}).success).toBe(false));
it('accepts exact boundary values and rejects unknown fields or empty mention selection',()=>{
 for(const count of [1,100])for(const windowSeconds of [1,3600])for(const durationSeconds of [60,2419200])expect(ruleInputSchema.safeParse({...base,threshold:{count,windowSeconds},action:{kind:'timeout',durationSeconds}}).success).toBe(true);
 expect(ruleInputSchema.safeParse({...base,token:'secret'}).success).toBe(false);expect(ruleInputSchema.safeParse({...base,trigger:{kind:'mention',users:false,roles:false,everyone:false}}).success).toBe(false);
});

