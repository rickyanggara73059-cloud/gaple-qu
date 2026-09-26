// Deterministic signaling/lifecycle regression tests, not a real ICE/NAT test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('app/components/VoiceChat.tsx', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020,
} }).outputText;
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };

function mount(playerId = 'a') {
  const effects = [], cleanups = [], sent = [], pcs = [], logs = [];
  let receive, subscription, timer, removed = false, stopped = false;
  const track = { enabled: true, stop() { stopped = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  class PC {
    signalingState = 'stable'; connectionState = 'new'; senders = []; added = [];
    remoteDescription = null; localDescription = null;
    constructor(config) { this.config = config; pcs.push(this); }
    getSenders() { return this.senders; }
    addTrack(track) {
      this.senders.push({ track });
      queueMicrotask(() => { if (this.signalingState === 'stable') this.onnegotiationneeded?.(); });
    }
    async createOffer() { return { type: 'offer', sdp: 'test-offer' }; }
    async createAnswer() { assert.equal(this.signalingState, 'have-remote-offer'); return { type: 'answer', sdp: 'test-answer' }; }
    async setLocalDescription(d) {
      if (d.type === 'answer') assert.equal(this.signalingState, 'have-remote-offer');
      this.localDescription = d;
      this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable';
    }
    async setRemoteDescription(d) {
      if (d.type === 'answer') assert.equal(this.signalingState, 'have-local-offer');
      this.remoteDescription = d;
      this.signalingState = d.type === 'offer' ? 'have-remote-offer' : 'stable';
      await Promise.resolve();
    }
    async addIceCandidate(c) { assert.ok(this.remoteDescription); this.added.push(c); }
    close() { this.signalingState = 'closed'; this.connectionState = 'closed'; }
  }
  const channel = {
    on(_type, _filter, callback) { receive = callback; return this; },
    subscribe(callback) { subscription = callback; return this; },
    async send(message) { sent.push(message.payload); return 'ok'; },
  };
  const jsx = (type, props) => ({ type, props });
  const context = {
    exports: {}, RTCPeerConnection: PC,
    console: { info: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    window: { isSecureContext: true, setInterval(fn) { timer = fn; return 1; }, clearInterval() { timer = null; } },
    navigator: { mediaDevices: { getUserMedia: async () => stream } },
    require(name) {
      if (name === 'react') return {
        useRef: (current) => ({ current }), useState: (initial) => [initial, () => {}],
        useEffect: (fn) => effects.push(fn),
      };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/lib/supabase') return { supabase: {
        channel: () => channel, removeChannel: async () => { removed = true; },
      } };
      throw Error(name);
    },
  };
  vm.runInNewContext(code, context);
  const remote = playerId === 'a' ? 'b' : 'a';
  const tree = context.exports.default({ roomId: 'test-room', playerId, players: [
    { id: playerId, connected: true }, { id: remote, connected: true },
  ] });
  effects.forEach((effect) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
  return {
    pcs, sent, logs,
    subscribe: () => subscription('SUBSCRIBED'),
    disconnect: () => subscription('CHANNEL_ERROR'),
    receive: (signal) => receive({ payload: { from: remote, to: playerId, ...signal } }),
    mic: () => tree.props.children[0].props.onClick(),
    hello: () => receive({ payload: { kind: 'hello', from: remote, to: null, micEnabled: true, readyFor: [playerId] } }),
    cleanup: () => cleanups.forEach((fn) => fn()),
    status: () => ({ removed, stopped, timer }),
  };
}

test('existing voice component is mounted in the game', () => {
  assert.match(fs.readFileSync('app/components/DominoGame.tsx', 'utf8'), /<VoiceChat\s/);
});

test('mic waits for subscription and mutual roster readiness before creating offer', async () => {
  const c = mount(); c.mic(); await settle(); assert.equal(c.pcs.length, 0);
  c.subscribe();
  await c.receive({ kind: 'hello', micEnabled: true, readyFor: [] });
  assert.equal(c.pcs.length, 0);
  await c.hello(); await settle();
  assert.equal(c.sent.filter(s => s.description?.type === 'offer').length, 1);
  await c.receive({ kind: 'description', description: { type: 'answer', sdp: 'remote-answer' } });
  assert.equal(c.pcs[0].signalingState, 'stable');
  c.cleanup();
});

test('early ICE is queued, duplicate suppressed, and flushed after remote offer', async () => {
  const c = mount(); c.subscribe();
  const candidate = { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 };
  await c.receive({ kind: 'ice', candidate });
  await c.receive({ kind: 'ice', candidate });
  assert.equal(c.pcs[0].added.length, 0);
  await c.receive({ kind: 'description', description: { type: 'offer', sdp: 'remote-offer' } });
  assert.equal(c.pcs[0].added.length, 1);
  assert.equal(c.sent.filter(s => s.description?.type === 'answer').length, 1);
  assert.equal(c.pcs[0].signalingState, 'stable'); c.cleanup();
});

test('overlapping description and ICE callbacks serialize correctly', async () => {
  const c = mount(); c.subscribe();
  await Promise.all([
    c.receive({ kind: 'description', description: { type: 'offer', sdp: 'remote-offer' } }),
    c.receive({ kind: 'ice', candidate: { candidate: 'test-candidate', sdpMid: '0' } }),
  ]);
  assert.equal(c.pcs[0].added.length, 1); assert.equal(c.pcs[0].signalingState, 'stable'); c.cleanup();
});

test('polite peer accepts colliding offer; impolite peer ignores it', async () => {
  for (const id of ['a', 'b']) {
    const c = mount(id); c.subscribe(); c.mic(); await settle(); await c.hello(); await settle();
    assert.equal(c.pcs[0].signalingState, 'have-local-offer');
    await c.receive({ kind: 'description', description: { type: 'offer', sdp: 'collision' } });
    assert.equal(c.pcs[0].signalingState, id === 'b' ? 'stable' : 'have-local-offer');
    c.cleanup();
  }
});

test('cleanup closes peers, stops mic, removes channel/timer and ignores late callback', async () => {
  const c = mount(); c.subscribe(); c.mic(); await settle(); await c.hello(); await settle();
  c.cleanup();
  assert.equal(c.pcs[0].signalingState, 'closed');
  assert.equal(c.status().removed, true); assert.equal(c.status().stopped, true); assert.equal(c.status().timer, null);
  const count = c.sent.length; c.subscribe(); await c.hello(); await settle();
  assert.equal(c.sent.length, count);
});

test('track negotiation waits while the local subscription is unavailable', async () => {
  const c = mount(); c.subscribe(); await c.hello(); c.disconnect();
  c.mic(); await settle(); assert.equal(c.pcs[0].getSenders().length, 0);
  c.subscribe(); await c.hello(); await settle();
  assert.equal(c.pcs[0].getSenders().length, 1); c.cleanup();
});
