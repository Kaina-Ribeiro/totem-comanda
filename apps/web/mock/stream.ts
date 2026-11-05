// The open kitchen streams (GET /v1/kitchen/stream) and how events reach them.
// Its own module so both the kitchen routes and the store pace can announce.

type Listener = { write: (chunk: string) => unknown };

const listeners = new Set<Listener>();

/** Adds an open stream; returns how to remove it when it closes. */
export function addKitchenListener(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sends one Server-Sent Event to every open kitchen stream. */
export function broadcastKitchenEvent(event: string, data: unknown): void {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const listener of listeners) listener.write(frame);
}
