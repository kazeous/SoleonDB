import {it,expect} from 'vitest';
import {assertTestSchema} from './database.js';
it.each(['public','eousbot_test_','eousbot_test_123;DROP SCHEMA public','production'])('refuses unsafe cleanup schema %s',name=>expect(()=>assertTestSchema(name)).toThrow());

