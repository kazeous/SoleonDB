import {validGreetingTemplate} from '@eousbot/contracts';
export function renderGreeting(template:string,context:{userMention:string;userName:string;guildName:string}):string{
 if(!validGreetingTemplate(template))throw new Error('Unsupported greeting template variable');
 const neutral=(value:string)=>value.replaceAll('@','@\u200b'),safe={user:context.userMention,username:neutral(context.userName).slice(0,200),server:neutral(context.guildName).slice(0,200)};
 return neutral(template).replaceAll(/\{(user|username|server)\}/g,(_match,key:keyof typeof safe)=>safe[key]).slice(0,2000).replace(/[\uD800-\uDBFF]$/,'');
}
