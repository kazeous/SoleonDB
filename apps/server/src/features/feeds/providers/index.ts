import type {FeedSource} from '@eousbot/contracts';
import type {FeedProvider} from '../types.js';
import type {ProviderDeps} from './common.js';
import {createRedditProvider} from './reddit.js';
import {createYouTubeProvider} from './youtube.js';
import {createTwitchProvider} from './twitch.js';
import {createRssProvider} from './rss.js';
export type {FeedCredentials} from './common.js';
export function createFeedProviders(deps:ProviderDeps):Record<FeedSource['provider'],FeedProvider>{return {reddit:createRedditProvider(deps),youtube:createYouTubeProvider(deps),twitch:createTwitchProvider(deps),rss:createRssProvider(deps)};}
