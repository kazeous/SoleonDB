import {it,expect} from 'vitest';
import {snowflakeSchema,featureKeySchema} from '@eousbot/contracts';
it('preserves IDs above Number.MAX_SAFE_INTEGER',()=>{expect(snowflakeSchema.parse('9223372036854775807')).toBe('9223372036854775807');expect(snowflakeSchema.safeParse(9223372036854775807).success).toBe(false);});
it.each(['', '-1','1.5','0','123abc','000123','18446744073709551616'])('rejects malformed or out-of-range ID %s',id=>expect(snowflakeSchema.safeParse(id).success).toBe(false));
it('accepts only registered feature keys',()=>{expect(featureKeySchema.safeParse('verification').success).toBe(true);expect(featureKeySchema.safeParse('secrets').success).toBe(false);});
