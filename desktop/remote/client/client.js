// Plazma Burst 2 remote play client. Shows the host's game as it arrives (JPEG frames over
// a WebSocket) and sends this browser's keys and mouse back. Nothing of the game runs here.
// The personal link is <host>/#t=<token>: the token stays after "#", so it is never part
// of a request URL; it is sent once, over the WebSocket.
(() => {
  'use strict';

  const MOD = { shift: 1, ctrl: 2, alt: 4, meta: 8 };
  const BUTTON = { 0: 0, 1: 1, 2: 2 }; // DOM button -> left, middle, right
  const RECONNECT_MS = 2000;
  const LINE_PX = 40; // wheel "lines" -> pixels

  const $ = (id) => document.getElementById(id);
  const canvas = $('screen');
  const ctx = canvas.getContext('2d');
  const overlay = $('overlay');
  const message = $('message');
  const play = $('play');
  const status = $('status');

  const token = new URLSearchParams(location.hash.slice(1)).get('t');

  let ws = null;
  let size = { width: canvas.width, height: canvas.height };
  let name = '';
  let playing = false; // keys and mouse go to the game
  let fatal = false;   // no reconnect (bad link, replaced, host full)
  let pending = null;  // the newest frame not drawn yet; older ones are dropped
  let drawing = false;
  let frames = 0;
  let move = null;     // the newest mouse position not sent yet
  const held = new Set();

  function show(text, button = false) {
    overlay.hidden = text === null;
    if (text !== null) message.textContent = text;
    play.hidden = !button;
  }

  function fit() {
    const scale = Math.min(innerWidth / size.width, innerHeight / size.height);
    canvas.style.width = `${Math.floor(size.width * scale)}px`;
    canvas.style.height = `${Math.floor(size.height * scale)}px`;
  }

  const send = (obj) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };

  function releaseKeys() {
    for (const code of held) send({ t: 'ku', code, key: '', m: 0 });
    held.clear();
  }

  // ----- connection -----
  function connect() {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
    ws.binaryType = 'blob';
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token }));
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') { pending = e.data; if (!drawing) draw(); return; }
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'ready') {
        size = { width: msg.width, height: msg.height };
        name = msg.name || '';
        canvas.width = size.width;
        canvas.height = size.height;
        fit();
        if (playing) show(null); else show('Connected.', true);
      } else if (msg.t === 'error') {
        fatal = true;
        show(msg.message || 'The host closed the connection.');
      }
    };
    ws.onclose = () => {
      held.clear();
      if (fatal) return;
      show('Connection lost. Reconnecting...');
      setTimeout(connect, RECONNECT_MS);
    };
  }

  async function draw() {
    drawing = true;
    while (pending) {
      const blob = pending;
      pending = null;
      try {
        const bmp = await createImageBitmap(blob);
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        bmp.close();
        frames++;
      } catch {}
    }
    drawing = false;
  }

  setInterval(() => {
    status.textContent = ws && ws.readyState === WebSocket.OPEN ? `${name} · ${frames} fps` : '';
    frames = 0;
  }, 1000);

  // ----- input -----
  const mods = (e) => (e.shiftKey ? MOD.shift : 0) | (e.ctrlKey ? MOD.ctrl : 0) | (e.altKey ? MOD.alt : 0) | (e.metaKey ? MOD.meta : 0);

  function startPlaying() {
    playing = true;
    canvas.focus();
    show(null);
  }

  function key(type) {
    return (e) => {
      if (!playing) return;
      e.preventDefault();
      if (type === 'kd') held.add(e.code); else held.delete(e.code);
      send({ t: type, code: e.code, key: e.key, m: mods(e), r: e.repeat });
    };
  }
  addEventListener('keydown', key('kd'), true);
  addEventListener('keyup', key('ku'), true);
  addEventListener('blur', releaseKeys);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseKeys(); });

  function at(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * size.width,
      y: ((e.clientY - r.top) / r.height) * size.height,
    };
  }

  canvas.addEventListener('pointermove', (e) => {
    if (!playing) return;
    move = { ...at(e), m: mods(e) };
  });
  // One mouse move per screen frame at most.
  const flushMove = () => {
    if (move) { send({ t: 'mm', ...move }); move = null; }
    requestAnimationFrame(flushMove);
  };
  requestAnimationFrame(flushMove);

  canvas.addEventListener('pointerdown', (e) => {
    if (!playing) { startPlaying(); return; }
    if (!(e.button in BUTTON)) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    send({ t: 'mm', ...at(e), m: mods(e) });
    send({ t: 'md', ...at(e), b: BUTTON[e.button], m: mods(e) });
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!playing || !(e.button in BUTTON)) return;
    e.preventDefault();
    send({ t: 'mu', ...at(e), b: BUTTON[e.button], m: mods(e) });
  });
  canvas.addEventListener('wheel', (e) => {
    if (!playing) return;
    e.preventDefault();
    const scale = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? size.height : 1;
    send({ t: 'wh', ...at(e), dx: e.deltaX * scale, dy: e.deltaY * scale, m: mods(e) });
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  play.addEventListener('click', startPlaying);
  $('fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
    canvas.focus();
  });
  addEventListener('resize', fit);

  fit();
  if (!token) {
    show('This page needs your personal link from the host (it ends with #t=...).');
    return;
  }
  connect();
})();
