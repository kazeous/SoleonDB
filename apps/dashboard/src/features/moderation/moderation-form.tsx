import {useGuild} from '@/app/guild-context';
import {SettingsForm} from '@/components/forms/settings-form';
import {Flag} from '@/components/forms/fields';
import {Choice,useEntities} from '@/components/forms/entities';
export function ModerationForm(){const {guildId}=useGuild(),{channels}=useEntities(guildId);return <SettingsForm feature="moderation" title="Moderation logging" description="Configure moderation and its log destination. Case history is read-only; moderation actions remain authorized Discord commands.">{form=><><Flag form={form} name="enabled" label="Enable moderation logging"/><Choice label="Log channel" nullable value={form.watch('logChannelId')} onChange={v=>form.setValue('logChannelId',v||null,{shouldDirty:true})} items={(channels.data??[]).filter(c=>c.type==='text').map(c=>({id:c.id,label:'#'+c.name}))} description="Requires View Channel, Send Messages and Embed Links. Failed log delivery never repeats a punishment."/></>}</SettingsForm>;}
