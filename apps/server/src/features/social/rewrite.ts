import {LinkifyIt} from 'linkify-it';
import {socialDomainsSchema} from '@eousbot/contracts';
import type {SocialDomains} from '@eousbot/contracts';
const links=new LinkifyIt({fuzzyLink:false});
export function rewriteSocialLinks(content:string,rawDomains:SocialDomains):{content:string;changed:boolean}{
 const domains=socialDomainsSchema.parse(rawDomains),matches=links.match(content)??[];let result='',offset=0,changed=false;
 for(const match of matches){if(!/^https?:\/\//i.test(match.raw))continue;let replacement:string|undefined;try{const url=new URL(match.raw);if(url.username||url.password)continue;const host=url.hostname.toLowerCase();let destination:string|undefined;
  if(['twitter.com','www.twitter.com','mobile.twitter.com','x.com','www.x.com'].includes(host))destination=domains.twitter;
  else if(['instagram.com','www.instagram.com'].includes(host)&&/^\/(?:p|reel|reels)\//.test(url.pathname))destination=domains.instagram;
  else if(['tiktok.com','www.tiktok.com','vm.tiktok.com'].includes(host))destination=domains.tiktok;
  else if(['reddit.com','www.reddit.com','old.reddit.com'].includes(host))destination=domains.reddit;
  if(destination&&destination!==host){url.hostname=destination;replacement=url.toString();}
 }catch{continue;}
 if(replacement){result+=content.slice(offset,match.index)+replacement;offset=match.lastIndex;changed=true;}}
 return {content:changed?result+content.slice(offset):content,changed};
}
