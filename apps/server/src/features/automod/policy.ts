import type {AutoModConfig} from '@eousbot/contracts';
import type {MessageSnapshot} from '../../discord/messages.js';
import {containsLink} from '../protection/matcher.js';
import {AppError} from '../../core/errors.js';
export function containsInvite(text:string):boolean {return /(?:discord\.(?:gg|io|me|li)\/|discord(?:app)?\.com\/invite\/)[^\s]+/i.test(text);}
export function classifyAutoMod(config:AutoModConfig,message:MessageSnapshot,recentCount:number):string|null {
 if(!config.enabled||message.authorKind!=='human'||config.exemptUserIds.includes(message.userId)||config.exemptRoleIds.some(id=>message.member.roleIds.includes(id)))return null;
 if(message.partial)throw new AppError('unavailable','Complete message content is required');
 if(config.spam.enabled&&recentCount>config.spam.count)return 'Message rate exceeded';
 const letters=message.content.match(/[a-z]/gi)??[],uppercase=message.content.match(/[A-Z]/g)??[];
 if(config.caps.enabled&&message.content.length>=10&&letters.length>=8&&uppercase.length/letters.length*100>config.caps.percent)return 'Excessive capital letters';
 if(config.bannedWords.some(word=>message.content.toLocaleLowerCase().includes(word.toLocaleLowerCase())))return 'Banned word usage';
 if(config.blockInvites&&containsInvite(message.content))return 'Discord invite blocked';
 if(config.blockLinks&&containsLink(message.content))return 'Link blocked';return null;
}

