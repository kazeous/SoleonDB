import {useGuild} from '@/app/guild-context';
import {SettingsPanel} from '@/components/settings-panel';
import {DiscordChannelField} from '@/components/discord-channel-field';
import {Flag} from '@/components/forms/fields';
export function SuggestionsForm(){const {guildId}=useGuild();return <SettingsPanel guildId={guildId} feature="suggestions" title="Suggestions" description="Members use /suggest in Discord. Persistent votes and status history stay with each suggestion. Requires Send Messages, Embed Links and Read Message History; optional discussions require Create Public Threads." renderFields={form=><><Flag form={form} name="enabled" label="Enable suggestions"/><DiscordChannelField {...{guildId,form}} name="channelId" label="Suggestion channel"/><Flag form={form} name="discussionThreads" label="Create discussion threads"/></>}/>;}
