import type {FeedItem} from '@eousbot/contracts';
import type {FeedProvider} from '../types.js';
import {FeedProviderError} from '../types.js';
import {object,array,text,plain,time,normalized,sourceOf,createRateGate,providerCall} from './common.js';
import type {ProviderDeps} from './common.js';
import {readXml} from './rss.js';
export function createYouTubeProvider(deps:ProviderDeps):FeedProvider{const gate=createRateGate(deps.clock);return {poll:(raw,cursor)=>providerCall(async()=>{const source=sourceOf(raw,'youtube');gate.assert();const response=await deps.fetchPublicText('https://www.youtube.com/feeds/videos.xml?channel_id='+encodeURIComponent(source.channelId));gate.check(response);const parsed=readXml(response.text);if(!Object.hasOwn(parsed,'feed'))throw new FeedProviderError('unavailable','YouTube returned an invalid feed');const items:FeedItem[]=[];for(const value of array(object(parsed.feed).entry).slice(0,100)){const entry=object(value),id=text(entry['yt:videoId']),channelId=text(entry['yt:channelId']);if(!/^[a-zA-Z0-9_-]{11}$/.test(id)||channelId&&channelId!==source.channelId)continue;const description=plain(object(entry['media:group'])['media:description']);items.push({id,title:plain(entry.title,256)||'YouTube upload',url:'https://www.youtube.com/watch?v='+id,publishedAt:time(entry.published??entry.updated),imageUrl:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',...(description?{description}:{})});}return normalized(items,cursor);})};}

