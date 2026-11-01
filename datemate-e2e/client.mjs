/**
 * DateMate E2E - API & WebSocket Client
 * Simulates mobile/web client network requests with automatic timing,
 * JWT management, multipart media uploads, and real-time Socket.IO chat connection.
 */

import { config } from './config.mjs';
import { TerminalUI } from './ui.mjs';

export class ApiClient {
  constructor(personaName = 'System') {
    this.personaName = personaName;
    this.baseUrl = config.baseUrl;
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.email = null;
    this.role = null;
  }

  setAuth(authResult) {
    if (authResult) {
      this.accessToken = authResult.access || authResult.accessToken;
      this.refreshToken = authResult.refresh || authResult.refreshToken;
      this.userId = authResult.userId || authResult.id;
      this.role = authResult.role;
    }
  }

  clearAuth() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.role = null;
  }

  async request(method, routePath, { body, headers = {}, query = null, timeout = config.requestTimeoutMs } = {}) {
    let url = routePath.startsWith('http') ? routePath : `${this.baseUrl}${routePath.startsWith('/') ? '' : '/'}${routePath}`;
    if (query && Object.keys(query).length > 0) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) q.append(k, String(v));
      }
      url += (url.includes('?') ? '&' : '?') + q.toString();
    }

    const reqHeaders = {
      Accept: 'application/json',
      ...headers,
    };

    if (this.accessToken && !reqHeaders.Authorization && !reqHeaders.authorization) {
      reqHeaders.Authorization = `Bearer ${this.accessToken}`;
    }

    let reqBody = undefined;
    if (body !== undefined && body !== null) {
      if (body instanceof FormData) {
        reqBody = body;
        // Don't set Content-Type header manually for FormData so boundary is added automatically
      } else if (typeof body === 'object') {
        reqHeaders['Content-Type'] = 'application/json';
        reqBody = JSON.stringify(body);
      } else {
        reqBody = body;
      }
    }

    const startTime = Date.now();
    let res;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: reqBody,
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      throw new Error(`[${this.personaName}] Network error ${method} ${routePath} (${durationMs}ms): ${err.message}`);
    }

    const durationMs = Date.now() - startTime;
    const contentType = res.headers.get('content-type') || '';
    let data = null;

    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }
    } else {
      data = await res.text();
    }

    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      data,
      durationMs,
      url,
      method,
    };
  }

  get(path, query = null, headers = {}) {
    return this.request('GET', path, { query, headers });
  }

  post(path, body = null, headers = {}) {
    return this.request('POST', path, { body, headers });
  }

  put(path, body = null, headers = {}) {
    return this.request('PUT', path, { body, headers });
  }

  patch(path, body = null, headers = {}) {
    return this.request('PATCH', path, { body, headers });
  }

  delete(path, body = null, headers = {}) {
    return this.request('DELETE', path, { body, headers });
  }

  async upload(path, fieldName, fileBuffer, filename, mimeType, additionalFields = {}) {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append(fieldName, blob, filename);

    for (const [k, v] of Object.entries(additionalFields)) {
      formData.append(k, String(v));
    }

    return this.request('POST', path, { body: formData });
  }
}

let ioClient = null;
try {
  const mod = await import('socket.io-client');
  ioClient = mod.io || mod.default?.io || mod.default;
} catch (e) {}

/**
 * Socket.IO Real-Time Chat Client
 * Uses socket.io-client or standard WebSocket protocol with JWT handshake.
 */
export class ChatWsClient {
  constructor(personaName, accessToken, baseUrl = config.baseUrl) {
    this.personaName = personaName;
    this.accessToken = accessToken;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }

  async connect() {
    if (ioClient) {
      return new Promise((resolve, reject) => {
        const sock = ioClient(`${this.baseUrl}/chat`, {
          transports: ['websocket', 'polling'],
          auth: {
            token: this.accessToken,
            accessToken: this.accessToken,
          },
          extraHeaders: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          timeout: 4000,
          reconnection: false,
        });

        const timer = setTimeout(() => {
          sock.disconnect();
          reject(new Error('Socket.IO connection timeout'));
        }, 4000);

        sock.on('connect', () => {
          clearTimeout(timer);
          this.connected = true;
          this.socket = sock;
          resolve(true);
        });

        sock.on('connect_error', (err) => {
          clearTimeout(timer);
          reject(err);
        });

        sock.onAny((event, ...args) => {
          this.emitLocal(event, args[0]);
        });
      });
    }

    return new Promise((resolve, reject) => {
      resolve(false);
    });
  }

  handlePacket(packet) {
    // Basic Socket.IO packet parser
    // 2 = ping -> respond with 3 pong
    if (packet === '2') {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send('3');
      }
      return;
    }

    // Event packet format: 42/chat,["eventName", payload]
    if (packet.startsWith('42/chat,')) {
      try {
        const jsonStr = packet.slice('42/chat,'.length);
        const [eventName, eventData] = JSON.parse(jsonStr);
        this.emitLocal(eventName, eventData);
      } catch (e) {
        // Ignore unparseable frames
      }
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emitLocal(event, data) {
    const handlers = this.listeners.get(event) || [];
    for (const h of handlers) {
      try {
        h(data);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    }
  }

  sendEvent(event, data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Socket is not connected');
    }
    const packet = `42/chat,${JSON.stringify([event, data])}`;
    this.socket.send(packet);
  }

  joinConversation(conversationId) {
    this.sendEvent('conversation.join', { conversationId });
  }

  sendMessage(conversationId, clientMessageId, content, messageType = 'TEXT') {
    this.sendEvent('message.send', {
      conversationId,
      clientMessageId,
      content,
      messageType,
    });
  }

  async waitForEvent(event, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (data) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.on(event, handler);
    });
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
    }
    this.connected = false;
  }
}
