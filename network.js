export class Network {
  constructor(url) {
    this.handlers = {};
    this.connected = false;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => { this.connected = true; };
    this.ws.onclose = () => { this.connected = false; this.emit('disconnect', {}); };
    this.ws.onmessage = (e) => { const m = JSON.parse(e.data); this.emit(m.type, m); };
  }
  on(type, fn) { this.handlers[type] = fn; }
  emit(type, msg) { this.handlers[type]?.(msg); }
  send(type, data) {
    if (this.ws.readyState === 1) this.ws.send(JSON.stringify({ type, ...data }));
  }
}