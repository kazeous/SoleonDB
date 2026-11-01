import {it,expect} from 'vitest';
import {automodDefaults} from '@eousbot/contracts';
import {classifyAutoMod} from '../src/features/automod/policy.js';
import {message} from './message.js';
it('retains rate, caps, word, invite and HTTP link policies',()=>{
 expect(classifyAutoMod({...automodDefaults,enabled:true,spam:{enabled:true,count:2,windowSeconds:5}},message(),3)).toMatch(/rate|spam/i);
 expect(classifyAutoMod({...automodDefaults,enabled:true,caps:{enabled:true,percent:70}},message({content:'THIS IS LOUD TEXT'}),1)).toMatch(/capital/i);
 expect(classifyAutoMod({...automodDefaults,enabled:true,bannedWords:['badphrase']},message({content:'Some BADPHRASE here'}),1)).toMatch(/word/i);
 expect(classifyAutoMod({...automodDefaults,enabled:true,blockInvites:true},message({content:'discord.gg/hello'}),1)).toMatch(/invite/i);
 expect(classifyAutoMod({...automodDefaults,enabled:true,blockLinks:true},message({content:'example.org'}),1)).toMatch(/link/i);
});
it('administrators are inspected unless an explicit exemption applies',()=>{
 const input=message({content:'https://example.org',member:{roleIds:['222222222222222222'],permissions:'8',highestRolePosition:99,displayName:'Admin'}}),config={...automodDefaults,enabled:true,blockLinks:true};
 expect(classifyAutoMod(config,input,1)).not.toBeNull();expect(classifyAutoMod({...config,exemptUserIds:[input.userId]},input,1)).toBeNull();expect(classifyAutoMod({...config,exemptRoleIds:['222222222222222222']},input,1)).toBeNull();
});

