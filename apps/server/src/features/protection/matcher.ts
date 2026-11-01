import {LinkifyIt} from 'linkify-it';
import type {ChannelRule} from '@eousbot/contracts';
import type {MessageSnapshot} from '../../discord/messages.js';
import {unavailable} from '../../core/errors.js';
const links=new LinkifyIt({fuzzyLink:true});
export function containsLink(text:string):boolean {
 return (links.match(text)??[]).some(match=>/^https?:/i.test(match.url));
}
export function matchesRule(rule:ChannelRule,message:MessageSnapshot):boolean {
 if(!rule.enabled||rule.guildId!==message.guildId||rule.channelId!==message.channelId||message.isThread||message.authorKind!=='human')return false;
 if(message.partial)throw unavailable('Complete message data is required for protection');
 if(rule.exemptUserIds.includes(message.userId)||rule.exemptRoleIds.some(id=>message.member.roleIds.includes(id)))return false;
 switch(rule.trigger.kind) {
  case 'any':return true;
  case 'mention':return (rule.trigger.users&&message.mentions.userIds.length>0)||(rule.trigger.roles&&message.mentions.roleIds.length>0)||(rule.trigger.everyone&&message.mentions.everyone);
  case 'link':return containsLink(message.content);
  case 'photo':return message.attachments.some(attachment=>{
   if(attachment.contentType&&attachment.contentType!=='application/octet-stream')return attachment.contentType.toLowerCase().startsWith('image/');
   return /\.(png|jpe?g|gif|webp|avif|bmp|tiff?|heic|heif|apng|svg)$/i.test(attachment.name??'');
  });
 }
}



