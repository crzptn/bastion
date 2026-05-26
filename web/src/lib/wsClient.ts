/**
 * wsClient — thin WebSocket wrapper used by useSessionMirror.
 *
 * Responsibilities:
 *   - Connect to /api/ws?room=<id>&session=<id>
 *   - Fire onMessage(WsMessage) on every incoming frame
 *   - Expose send(WsMessage) for outbound frames
 *   - Expose close() for cleanup
 *
 * No React. No DOM imports beyond WebSocket. Pure TypeScript.
 */

import type { WsMessage } from './wsOpcodes';
import { PROTOCOL_VERSION } from './wsOpcodes';
import { apiBaseUrl } from './env';

export interface WsClientOptions {
  roomId: string;
  sessionId: string;
  onMessage: (msg: WsMessage) => void;
  onClose?: () => void;
  onError?: (ev: Event) => void;
}

export interface WsClient {
  send: (msg: WsMessage) => void;
  close: () => void;
  isOpen: () => boolean;
}

/**
 * Creates and connects a WebSocket client.
 * Returns a WsClient handle for sending messages and closing the connection.
 *
 * The WebSocket is connected to:
 *   ws(s)://<host>/api/ws?room=<roomId>&session=<sessionId>
 */
export function createWsClient(opts: WsClientOptions): WsClient {
  const base = apiBaseUrl();
  // Convert http(s) → ws(s); empty base means same origin.
  const wsBase = base
    ? base.replace(/^http/, 'ws')
    : `ws${location.protocol === 'https:' ? 's' : ''}://${location.host}`;

  const url = `${wsBase}/api/ws?room=${encodeURIComponent(opts.roomId)}&session=${encodeURIComponent(opts.sessionId)}`;
  const ws = new WebSocket(url);

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as WsMessage;
      opts.onMessage(msg);
    } catch {
      // Malformed frame — silently ignore.
    }
  };

  ws.onclose = () => {
    opts.onClose?.();
  };

  ws.onerror = (ev) => {
    opts.onError?.(ev);
  };

  return {
    send(msg: WsMessage) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ...msg, version: PROTOCOL_VERSION }));
      }
    },
    close() {
      ws.close();
    },
    isOpen() {
      return ws.readyState === WebSocket.OPEN;
    },
  };
}
