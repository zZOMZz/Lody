// Uses the packages already installed for apps/cli; no separate dependency versions.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../../apps/cli/package.json', import.meta.url));

async function effectLab() {
  const { Effect, Exit } = require('effect');
  for (const fail of [false, true]) {
    const events = [];
    const program = Effect.scoped(
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            events.push('acquire');
            return 'resource';
          }),
          () =>
            Effect.sync(() => {
              events.push('release');
            })
        );
        events.push('use');
        if (fail) yield* Effect.fail('synthetic failure');
        return 'done';
      })
    );
    const exit = await Effect.runPromiseExit(program);
    assert.equal(Exit.isFailure(exit), fail);
    assert.deepEqual(events, ['acquire', 'use', 'release']);
  }
  console.log('effect: acquire/use/release on success and failure');
}

function loroLab() {
  const { LoroDoc } = require('loro-crdt');
  const a = new LoroDoc();
  const b = new LoroDoc();
  a.setPeerId('1');
  b.setPeerId('2');
  a.getList('messages').push('base');
  a.commit();
  b.import(a.export({ mode: 'snapshot' }));
  a.getList('messages').push('from-a');
  b.getList('messages').push('from-b');
  a.commit();
  b.commit();
  const aDelta = a.export({ mode: 'update', from: b.oplogVersion() });
  const bDelta = b.export({ mode: 'update', from: a.oplogVersion() });
  a.import(bDelta);
  b.import(aDelta);
  assert.deepEqual(a.toJSON(), b.toJSON());
  assert.deepEqual([...a.toJSON().messages].sort(), ['base', 'from-a', 'from-b']);
  const beforeReplay = a.toJSON();
  a.import(bDelta);
  assert.deepEqual(a.toJSON(), beforeReplay);
  const restored = new LoroDoc();
  restored.import(a.export({ mode: 'snapshot' }));
  assert.deepEqual(restored.toJSON(), a.toJSON());
  console.log('loro: converged, replay-idempotent, snapshot-restored');
}

const selected = process.argv[2];
if (!['effect', 'loro'].includes(selected)) throw new Error('Choose effect or loro');
if (selected === 'effect') await effectLab();
else loroLab();
