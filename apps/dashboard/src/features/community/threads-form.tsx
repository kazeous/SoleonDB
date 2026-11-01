import {useGuild} from '@/app/guild-context';
import {SettingsPanel} from '@/components/settings-panel';
import {DiscordChannelField} from '@/components/discord-channel-field';
import {Choice} from '@/components/forms/entities';
import {Flag} from '@/components/forms/fields';
export function ThreadsForm(){const {guildId}=useGuild();return <SettingsPanel guildId={guildId} feature="threads" title="Auto threads" description="Creates one thread for each new human message in selected text channels. Requires Create Public Threads, Send Messages in Threads and Read Message History. Messages selected for moderation deletion are skipped." renderFields={form=><><Flag form={form} name="enabled" label="Enable auto threads"/><DiscordChannelField {...{guildId,form}} name="channelIds" label="Auto-thread channels" multiple/><Choice label="Auto archive after" value={String(form.watch('autoArchiveDuration'))} onChange={v=>form.setValue('autoArchiveDuration',Number(v) as 60|1440|4320|10080,{shouldDirty:true})} items={[{id:'60',label:'1 hour'},{id:'1440',label:'1 day'},{id:'4320',label:'3 days'},{id:'10080',label:'7 days'}]}/></>}/>;}
