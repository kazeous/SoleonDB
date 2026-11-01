import {useGuild} from '@/app/guild-context';
import {SettingsPanel} from '@/components/settings-panel';
import {DiscordChannelField} from '@/components/discord-channel-field';
import {Flag,TextField} from '@/components/forms/fields';
export function VoiceForm(){const {guildId}=useGuild();return <SettingsPanel guildId={guildId} feature="voice" title="Voice hubs" description="Joining a selected hub creates a room with persistent owner controls. Requires Manage Channels, Move Members, Connect and Send Messages. Owner controls remain in Discord; only recorded empty rooms are cleaned up." renderFields={form=><><Flag form={form} name="enabled" label="Enable voice hubs"/><DiscordChannelField {...{guildId,form}} name="hubChannelIds" label="Voice hub channels" type="voice" multiple/><TextField form={form} name="roomFormat" label="Room name format" description="Supported variable: {user}. Limits and permissions are checked again in Discord."/></>}/>;}
