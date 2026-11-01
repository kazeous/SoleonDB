import {useGuild} from '@/app/guild-context';
import {SettingsPanel} from '@/components/settings-panel';
import {DiscordChannelField} from '@/components/discord-channel-field';
import {Flag,TextField} from '@/components/forms/fields';
export function StarboardForm(){const {guildId}=useGuild();return <SettingsPanel guildId={guildId} feature="starboard" title="Starboard" description="Distinct human stars (⭐) count; author self-stars and bots do not. Requires Read Message History, Send Messages and Embed Links. Entries update or disappear as stars change." renderFields={form=><><Flag form={form} name="enabled" label="Enable starboard"/><DiscordChannelField {...{guildId,form}} name="channelId" label="Starboard channel"/><TextField form={form} name="threshold" label="Stars required" type="number"/></>}/>;}
