// Day 1 imports real pure modules. Days 2/3/5 are teaching models, not product tests.
import assert from 'node:assert/strict';
import {
  createCapabilitySet,
  LOCAL_PLATFORM_CAPABILITIES,
} from '../../../../packages/platform/src/capabilities.ts';
import { resolvePlatformKind } from '../../../../packages/shared/src/platform-kind.ts';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function labPlatform() {
  assert.equal(resolvePlatformKind(undefined), 'local');
  assert.equal(resolvePlatformKind(' cloud '), 'cloud');
  assert.throws(() => resolvePlatformKind('cluod'), /Unrecognized/);
  assert.equal(LOCAL_PLATFORM_CAPABILITIES.has('remoteMachines'), false);
  const capabilities = createCapabilitySet(['remoteMachines', 'remoteMachines']);
  assert.deepEqual(capabilities.list(), ['remoteMachines']);
  assert.equal(capabilities.has('billing'), false);
}

function labBoundary() {
  let count = 0;
  const invoke = (channel, payload) => {
    if (channel !== 'counter.add') throw new Error('blocked channel');
    if (!payload || Array.isArray(payload) || !Number.isSafeInteger(payload.delta)) {
      throw new Error('invalid delta');
    }
    const next = count + payload.delta;
    if (!Number.isSafeInteger(next)) throw new Error('invalid result');
    count = next;
    return count;
  };
  assert.equal(invoke('counter.add', { delta: 2 }), 2);
  for (const payload of [null, [], { delta: '3' }, { delta: 1.5 }]) {
    assert.throws(() => invoke('counter.add', payload), /invalid/);
    assert.equal(count, 2);
  }
  assert.throws(() => invoke('files.delete', { delta: 8 }), /blocked/);
  assert.equal(count, 2);
  assert.equal(invoke('counter.add', { delta: 3 }), 5);
}

async function labCancellation() {
  const firstStarted = deferred();
  const firstFinished = deferred();
  const controller = new AbortController();
  const changes = [];
  async function configure(signal) {
    try {
      signal.throwIfAborted();
      changes.push('first-start');
      firstStarted.resolve();
      await firstFinished.promise;
      signal.throwIfAborted();
      changes.push('second');
      changes.push('persist');
    } finally {
      changes.push('release');
    }
  }
  // Register rejection handling before raising cancellation.
  const rejected = assert.rejects(configure(controller.signal), { name: 'AbortError' });
  await firstStarted.promise;
  controller.abort();
  firstFinished.resolve();
  await rejected;
  assert.deepEqual(changes, ['first-start', 'release']);
  changes.length = 0;
  await configure(new AbortController().signal);
  assert.deepEqual(changes, ['first-start', 'second', 'persist', 'release']);
}

async function labEpoch() {
  let epoch = 0;
  let cached;
  const oldRead = deferred();
  const newRead = deferred();
  async function hydrate(read) {
    const startedAt = epoch;
    const body = await read;
    if (startedAt === epoch) cached = body;
  }
  const oldPending = hydrate(oldRead.promise);
  epoch += 1;
  const newPending = hydrate(newRead.promise);
  newRead.resolve('new');
  await newPending;
  oldRead.resolve('old');
  await oldPending;
  assert.equal(cached, 'new');
}

const labs = new Map([
  ['1', labPlatform],
  ['2', labBoundary],
  ['3', labCancellation],
  ['5', labEpoch],
]);
const selected = process.argv[2];
if (selected && !labs.has(selected)) throw new Error('Choose 1, 2, 3, or 5');
for (const [day, run] of labs) {
  if (selected && selected !== day) continue;
  await run();
  console.log(`day ${day}: ok`);
}
