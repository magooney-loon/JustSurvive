import spacetimedb from './schema.js';

export const onConnect = spacetimedb.clientConnected((_ctx) => {
  // Phase 2: create/update player presence
});

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {
  // Phase 2: clean up lobby membership
});
