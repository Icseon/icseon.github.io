const DISCORD_ID = '382220159982501888';

const CAN_FETCH = location.protocol === 'http:' || location.protocol === 'https:';
const SIZE_HINT = {
  bloop: 65280,
  denySound: 31764,
  happySound: 27360,
  typeSound: 5336,
  audio: 3260928,
};
const TYPE_VOICES = 6;
const typeSound = document.getElementById('typeSound');
typeSound.volume = 0.5;
const typePool = Array.from({ length: TYPE_VOICES }, () => {
  const voice = typeSound.cloneNode();
  voice.volume = typeSound.volume;
  return voice;
});
let typeVoice = 0;
const syncTypePool = () => {
  typePool.forEach((voice) => {
    voice.src = typeSound.src;
    voice.load();
  });
};
let unlocking = false;
let lofiStarted = false;
let lofiReady = Promise.resolve();
let unlockDone = Promise.resolve();

const loadFill = document.querySelector('#loadBar i');
const progress = {};
const setProgress = (id, v) => {
  progress[id] = Math.max(0, Math.min(1, v));
  const slots = ['fonts', 'bloop', 'denySound', 'happySound', 'typeSound'];
  const pct = slots.reduce((a, k) => a + (progress[k] || 0), 0) / slots.length;
  if (loadFill) {
    loadFill.style.width = (pct * 100).toFixed(1) + '%';
  }
};

const whenPlayable = (a, ms) => {
  return new Promise((res) => {
    if (a.readyState >= 4) {
      return res(true);
    }
    let done = false;
    const fin = (v) => {
      if (done) {
        return;
      }
      done = true;
      a.removeEventListener('canplaythrough', ok);
      a.removeEventListener('error', no);
      clearTimeout(t);
      res(v);
    };
    const ok = () => fin(true);
    const no = () => fin(false);
    a.addEventListener('canplaythrough', ok);
    a.addEventListener('error', no);
    const t = setTimeout(() => fin(false), ms || 8000);
  });
};

const streamToBlob = async (url, onBytes) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(res.status);
  }
  const total = +res.headers.get('content-length') || 0;
  if (!(res.body && res.body.getReader)) {
    const b = await res.blob();
    onBytes(b.size, b.size);
    return b;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    got += value.length;
    onBytes(got, total);
  }
  return new Blob(chunks, { type: res.headers.get('content-type') || 'audio/mpeg' });
};

const preloadSound = async (id, opts) => {
  opts = opts || {};
  const a = document.getElementById(id);
  const hint = SIZE_HINT[id] || 0;
  const bump = (got, total) => setProgress(id, total || hint ? got / (total || hint) : 0);
  if (CAN_FETCH) {
    try {
      const blob = await streamToBlob(a.getAttribute('src'), bump);
      await unlockDone;
      if (!opts.keepSrc || !lofiStarted) {
        a.src = URL.createObjectURL(blob);
      }
      await whenPlayable(a, 4000);
      setProgress(id, 1);
      return;
    } catch (_) {}
  }
  a.preload = 'auto';
  try {
    a.load();
  } catch (_) {}
  await whenPlayable(a, opts.timeout || 8000);
  setProgress(id, 1);
};

const preloadFonts = () => {
  if (!document.fonts || !document.fonts.load) {
    setProgress('fonts', 1);
    return Promise.resolve();
  }
  return Promise.all(
    [
      '700 1rem "Baloo 2"',
      '600 1rem "Baloo 2"',
      '700 1rem Quicksand',
      '600 1rem Quicksand',
      '500 1rem Quicksand',
      '400 1rem Quicksand',
    ].map((f) => document.fonts.load(f).catch(() => {})),
  )
    .then(() => document.fonts.ready)
    .catch(() => {})
    .then(() => setProgress('fonts', 1));
};

const unlockAudio = () => {
  unlocking = true;
  const els = [
    ...['audio', 'bloop', 'denySound', 'happySound', 'typeSound'].map((id) =>
      document.getElementById(id),
    ),
    ...typePool,
  ];
  unlockDone = Promise.all(
    els.map((a) => {
      const v = a.volume;
      a.volume = 0;
      let p;
      try {
        p = a.play();
      } catch (_) {}
      return Promise.resolve(p)
        .then(() => {
          a.pause();
          a.currentTime = 0;
        })
        .catch(() => {})
        .then(() => {
          a.volume = v;
        });
    }),
  ).then(() => {
    unlocking = false;
  });
  return unlockDone;
};

(() => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  ['fonts', 'bloop', 'denySound', 'happySound', 'typeSound', 'audio'].forEach((k) =>
    setProgress(k, 0),
  );

  const critical = Promise.all([
    preloadFonts(),
    preloadSound('bloop'),
    preloadSound('denySound'),
    preloadSound('happySound'),
    preloadSound('typeSound').then(syncTypePool),
  ]);

  lofiReady = Promise.race([critical, delay(1500)]).then(() =>
    preloadSound('audio', { keepSrc: true, timeout: 20000 }),
  );

  Promise.race([critical, delay(8000)]).then(() => enableEnter());
})();

(() => {
  const s = document.getElementById('stars');
  for (let i = 0; i < 70; i++) {
    const d = document.createElement('div');
    d.className = 'star';
    const sz = Math.random() * 2 + 1;
    d.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 3}s`;
    s.appendChild(d);
  }
})();

const PETAL_SVG = ['#ffd1e8', '#ffc0dd', '#ffe0f0', '#ffb3d9'].map(
  (c) =>
    `data:image/svg+xml;utf8,` +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M10 2c3 2 6 5 6 8s-3 6-6 8c-3-2-6-5-6-8s3-6 6-8z' fill='${c}'/></svg>`,
    ),
);
const spawnPetal = () => {
  const p = document.createElement('img');
  p.className = 'petal';
  p.src = PETAL_SVG[Math.floor(Math.random() * PETAL_SVG.length)];
  const sz = Math.random() * 16 + 10;
  p.style.width = sz + 'px';
  p.style.left = Math.random() * 100 + 'vw';
  const dur = Math.random() * 6 + 7;
  p.style.animation = `fall ${dur}s linear forwards`;
  p.style.setProperty('opacity', Math.random() * 0.4 + 0.5);
  document.body.appendChild(p);
  setTimeout(() => p.remove(), dur * 1000);
};
let petalTimer = null;
const startPetals = () => {
  if (petalTimer) {
    return;
  }
  petalTimer = setInterval(spawnPetal, 650);
  for (let i = 0; i < 6; i++) {
    setTimeout(spawnPetal, i * 300);
  }
};

const $ = (id) => document.getElementById(id);
const statusDot = $('statusDot');
const avatar = $('avatar');
const dActivity = $('dActivity');
const actArt = $('actArt');
const actLabel = $('actLabel');
const actName = $('actName');
const actDetails = $('actDetails');
const actState = $('actState');
const actElapsed = $('actElapsed');

const ACT_LABEL = {
  0: 'Playing',
  1: 'Streaming',
  2: 'Listening to',
  3: 'Watching',
  5: 'Competing in',
};

const setStatus = (state) => {
  statusDot.className = 'status-dot ' + state;
};

const assetUrl = (a, img) => {
  if (!img) {
    return '';
  }
  if (img.startsWith('spotify:')) {
    return 'https://i.scdn.co/image/' + img.slice(8);
  }
  if (img.startsWith('mp:')) {
    return 'https://media.discordapp.net/' + img.slice(3);
  }
  if (a.application_id) {
    return `https://cdn.discordapp.com/app-assets/${a.application_id}/${img}.png`;
  }
  return '';
};
const show = (el, txt) => {
  if (txt) {
    el.textContent = txt;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
};

let elStart = null;
let elEnd = null;
const fmt = (ms) => {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return (h ? h + ':' : '') + p(m) + ':' + p(ss);
};
const tick = () => {
  if (elStart == null) {
    actElapsed.hidden = true;
    return;
  }
  const now = Date.now();
  actElapsed.textContent = elEnd
    ? '♪ ' + fmt(now - elStart) + ' / ' + fmt(elEnd - elStart)
    : fmt(now - elStart) + ' elapsed';
  actElapsed.hidden = false;
};
setInterval(tick, 1000);

const renderActivity = (a) => {
  if (!a || !a.name) {
    dActivity.hidden = true;
    elStart = null;
    return;
  }
  actLabel.textContent = ACT_LABEL[a.type] || 'Playing';
  actName.textContent = a.name || '';

  show(actDetails, a.details);
  show(actState, a.type === 2 && a.state ? 'by ' + a.state : a.state);

  const big = a.assets && (a.assets.large_image || a.assets.small_image);
  const url = assetUrl(a, big);
  if (url) {
    actArt.src = url;
    actArt.hidden = false;
  } else {
    actArt.hidden = true;
  }

  if (a.timestamps && a.timestamps.start) {
    elStart = a.timestamps.start;
    elEnd = a.timestamps.end || null;
    tick();
  } else {
    elStart = null;
    actElapsed.hidden = true;
  }
  dActivity.hidden = false;
};

const renderPresence = (d) => {
  if (!d) {
    return;
  }
  const u = d.discord_user || {};

  if (u.id && u.avatar) {
    const ext = u.avatar.startsWith('a_') ? 'gif' : 'png';
    const img = new Image();
    img.src = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${ext}?size=128`;
    img.onload = () => {
      avatar.replaceWith(Object.assign(img, { id: 'avatar' }));
    };
  }
  setStatus(d.discord_status || 'offline');

  const acts = (d.activities || []).filter((a) => a.type !== 4);
  const spotify = acts.find((a) => a.type === 2) || (d.listening_to_spotify ? acts[0] : null);
  renderActivity(spotify || acts[0] || null);
};

const connectLanyard = () => {
  let ws;
  let hb;
  let tries = 0;
  const open = () => {
    ws = new WebSocket('wss://api.lanyard.rest/socket');
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.op === 1) {
        hb = setInterval(
          () => ws.readyState === 1 && ws.send(JSON.stringify({ op: 3 })),
          m.d.heartbeat_interval,
        );
        ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_ID } }));
      } else if (m.op === 0) {
        renderPresence(m.d);
      }
    };
    ws.onclose = () => {
      clearInterval(hb);
      if (tries < 6) {
        tries++;
        setTimeout(open, 2500);
      }
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch (_) {}
    };
  };
  open();
};
connectLanyard();

const musicBtn = document.getElementById('music');
const audio = document.getElementById('audio');
const MUSIC_VOLUME = 0.35;
const MUSIC_FADE_MS = 450;
audio.volume = MUSIC_VOLUME;
let musicMuted = false;
let musicFade = 0;

const fadeMusic = (target) => {
  cancelAnimationFrame(musicFade);
  const from = audio.volume;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / MUSIC_FADE_MS);
    const eased = k * k * (3 - 2 * k);
    audio.volume = Math.max(0, Math.min(1, from + (target - from) * eased));
    if (k < 1) {
      musicFade = requestAnimationFrame(step);
    }
  };
  musicFade = requestAnimationFrame(step);
};

audio.addEventListener('play', () => {
  if (unlocking) {
    return;
  }
  musicBtn.classList.add('show');
  if (!musicMuted) {
    musicBtn.classList.add('playing');
  }
});
audio.addEventListener('pause', () => {
  if (unlocking) {
    return;
  }
  musicBtn.classList.remove('playing');
});

const playMusic = () => {
  lofiStarted = true;
  audio.play().catch(() => {
    lofiReady.then(() => audio.play().catch(() => {}));
  });
};
musicBtn.addEventListener('click', () => {
  musicMuted = !musicMuted;
  musicBtn.classList.toggle('playing', !musicMuted);
  fadeMusic(musicMuted ? 0 : MUSIC_VOLUME);
  if (!musicMuted && audio.paused) {
    audio.play().catch(() => {});
  }
});

let actx = null;
const initAudio = () => {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {}
  }
  if (actx && actx.state === 'suspended') {
    actx.resume();
  }
};

const blip = (f1 = 660, f2 = 990) => {
  if (!actx) {
    return;
  }
  const t = actx.currentTime;
  [
    [f1, t, 0],
    [f2, t + 0.06, 0.06],
  ].forEach(([f, start, d]) => {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, start);
    o.frequency.exponentialRampToValueAtTime(f * 1.5, start + 0.09);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.14, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    o.connect(g).connect(actx.destination);
    o.start(start);
    o.stop(start + 0.18);
  });
};

const pop = () => {
  if (!actx) {
    return;
  }
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(520, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.05);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g).connect(actx.destination);
  o.start(t);
  o.stop(t + 0.16);
};
const wireSounds = () => {
  document.querySelectorAll('.socials a, #music, #mailClose, #mailSend, #frCopy').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      if (!sliding) {
        blip();
      }
    });
    el.addEventListener('click', pop);
  });
};

const NARROW = matchMedia('(max-width: 720px)');
const FLAT = matchMedia('(max-width: 720px), (hover: none), (pointer: coarse)');
const bg = document.querySelector('.bg');
const cardEl = document.querySelector('.card');
const stageEl = document.querySelector('.stage');
let tiltTX = 0;
let tiltTY = 0;
let tiltX = 0;
let tiltY = 0;
let cardMotion = false;
let slideTX = 0;
let slideX = 0;
const resetTilt = () => {
  tiltTX = 0;
  tiltTY = 0;
  bg.style.transform = '';
  stageEl.style.transform = '';
};
FLAT.addEventListener('change', resetTilt);
window.addEventListener('mousemove', (e) => {
  if (FLAT.matches || document.body.classList.contains('blocked')) {
    tiltTX = 0;
    tiltTY = 0;
    return;
  }
  const nx = e.clientX / innerWidth - 0.5;
  const ny = e.clientY / innerHeight - 0.5;
  tiltTY = nx * 8;
  tiltTX = -ny * 8;
  bg.style.transform = `scale(1.08) translate(${(nx * -16).toFixed(1)}px,${(ny * -16).toFixed(1)}px)`;
});
let motionStart = 0;
const cardLoop = (ts) => {
  if (!cardMotion) {
    return;
  }
  requestAnimationFrame(cardLoop);
  if (!motionStart) {
    motionStart = ts;
  }
  const e = ts - motionStart;
  const ramp = Math.min(1, e / 1000);
  tiltX += (tiltTX - tiltX) * 0.08;
  tiltY += (tiltTY - tiltY) * 0.08;
  slideX += (slideTX - slideX) * 0.12;
  const wave = Math.sin(e / 1900) * ramp;
  const breathe = wave * 6;
  const s = 1 + wave * 0.006;

  if (FLAT.matches) {
    tiltTX = 0;
    tiltTY = 0;
    stageEl.style.transform = '';
  } else {
    stageEl.style.transform = `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
  }

  cardEl.style.transform = `translateX(${slideX.toFixed(1)}px) translateY(${breathe.toFixed(2)}px) scale(${s.toFixed(4)})`;
};

const SPARKS = ['✦', '✧', '⋆', '·', '♡', 'ᵕ'];
let lastSpark = 0;
window.addEventListener('mousemove', (e) => {
  if (!entered || document.body.classList.contains('blocked')) {
    return;
  }
  const now = performance.now();
  if (now - lastSpark < 45) {
    return;
  }
  lastSpark = now;
  const s = document.createElement('div');
  s.className = 'sparkle';
  s.textContent = SPARKS[Math.floor(Math.random() * SPARKS.length)];
  s.style.left = e.clientX + 'px';
  s.style.top = e.clientY + 'px';
  s.style.fontSize = Math.random() * 8 + 7 + 'px';
  s.style.setProperty('--dx', Math.random() * 30 - 15 + 'px');
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 900);
});

const reachEl = $('reach');
const REACH_TEXT = 'Feel free to reach out to me using the links below!';

const typeTick = () => {
  const voice = typePool[typeVoice];
  typeVoice = (typeVoice + 1) % typePool.length;
  try {
    voice.currentTime = 0;
    voice.play().catch(() => {});
  } catch (_) {}
};
const linksWrap = document.getElementById('linksWrap');
const bloop = document.getElementById('bloop');
bloop.volume = 0.6;
let ri = 0;
let reachStarted = false;
let linksRevealed = false;
const typeReach = () => {
  reachEl.textContent = REACH_TEXT.slice(0, ri);
  const nh = reachEl.scrollHeight;
  if (nh > (parseFloat(reachEl.style.height) || 0)) {
    reachEl.style.height = nh + 'px';
  }
  if (ri >= REACH_TEXT.length) {
    revealLinks();
    return;
  }
  const ch = REACH_TEXT[ri];
  if (ch !== ' ') {
    typeTick();
  }
  ri++;
  let d = 52 + Math.random() * 46;
  if ('.!,'.includes(ch)) {
    d = 280;
  }
  setTimeout(typeReach, d);
};
const revealLinks = () => {
  if (linksRevealed) {
    return;
  }
  linksRevealed = true;
  try {
    bloop.currentTime = 0;
    bloop.play().catch(() => {});
  } catch (_) {}
  linksWrap.classList.add('show');
  setTimeout(() => {
    linksWrap.classList.add('done');
    playMusic();
    const eb = document.getElementById('emailBtn');
    if (eb) {
      eb.classList.add('attn');
      setTimeout(() => eb.classList.remove('attn'), 1750);
    }
  }, 780);
};
const startReach = () => {
  if (reachStarted) {
    return;
  }
  reachStarted = true;
  reachEl.style.height = '0px';
  reachEl.classList.add('on');
  ri = 0;
  typeReach();
};

const EMAIL = 'me@icseon.com';
const emailCard = $('emailCard');
const emailBtn = $('emailBtn');
const mailClose = $('mailClose');
const mailSend = $('mailSend');
const mailName = $('mailName');
const mailSubject = $('mailSubject');
const mailBody = $('mailBody');
let mailOpen = false;
let sliding = false;

const BLACKLIST = new Set([
  'fnhnd1',
  '1tvo86l',
  'zpzehw',
  '30a2ez',
  '1cxjqxs',
  '7cki18',
  'muuv4m',
  'oa1eyr',
  '12qwwjz',
  'e69jw7',
  '1o9xtuh',
  '14tin6b',
  'ata5lu',
  'l4gh1n',
]);
const WHITELIST = new Set([
  '8t6mbh',
  '147zfjp',
  '1k566cc',
  '1a7v8gi',
  '1tur08a',
  'l14ijv',
  '1a7ogi7',
  'u50l2m',
]);
const _h = (str) => {
  let h = 2166136261;
  const s = 'q9x2_' + str;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};
const isBlocked = (name) => {
  return BLACKLIST.has(_h(name.trim().toLowerCase()));
};
const isWhitelisted = (name) => {
  return WHITELIST.has(_h(name.trim().toLowerCase()));
};
const happySound = $('happySound');
happySound.volume = 0.5;
const nameLabel = $('nameLabel');
let greetTimer = null;
const greet = () => {
  try {
    happySound.currentTime = 0;
    happySound.play().catch(() => {});
  } catch (_) {}
  nameLabel.textContent = 'hey there :)';
  clearTimeout(greetTimer);
  greetTimer = setTimeout(() => {
    nameLabel.textContent = 'Discord username';
  }, 1000);

  mailName.readOnly = true;
  [mailSubject, mailBody].forEach((el) => {
    el.classList.add('skeleton');
    el.readOnly = true;
  });
  mailSend.classList.add('skeleton');
  mailSend.disabled = true;
  setTimeout(showFriendView, 1050);
};
const emailForm = $('emailForm');
const friendView = $('friendView');
const frCopy = $('frCopy');
const showFriendView = () => {
  emailForm.hidden = true;
  friendView.hidden = false;
};
const fallbackCopy = (t, cb) => {
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    cb && cb();
  } catch (_) {}
};
frCopy.addEventListener('click', () => {
  const done = () => {
    frCopy.textContent = 'copied!';
    setTimeout(() => (frCopy.textContent = 'copy username'), 1200);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText('icseon')
      .then(done)
      .catch(() => fallbackCopy('icseon', done));
  } else {
    fallbackCopy('icseon', done);
  }
});
const denySound = $('denySound');
denySound.volume = 0.6;
const denyAccess = () => {
  try {
    denySound.currentTime = 0;
    denySound.play().catch(() => {});
  } catch (_) {}
  document.body.classList.add('blocked');
  closeMail();
  emailBtn.remove();
  audio.pause();
  musicBtn.remove();
  linksWrap.classList.remove('show', 'done');
  reachEl.classList.remove('on');
  reachEl.textContent = 'Icseon has blocked you. Please do not attempt to reach out in any way.';
  reachEl.style.height = reachEl.scrollHeight + 'px';
};
const nameSpin = $('nameSpin');
let nameTimer = null;
let checkTimer = null;
mailName.addEventListener('input', () => {
  clearTimeout(nameTimer);
  clearTimeout(checkTimer);
  nameSpin.hidden = true;
  const val = mailName.value.trim();
  if (!val) {
    return;
  }
  nameTimer = setTimeout(() => {
    if (isWhitelisted(val)) {
      greet();
      return;
    }
    nameSpin.hidden = false;
    checkTimer = setTimeout(() => {
      nameSpin.hidden = true;
      if (isBlocked(val)) {
        denyAccess();
      }
    }, 900);
  }, 450);
});
const layoutMail = () => {
  if (!mailOpen) {
    return;
  }
  if (NARROW.matches) {
    stageEl.classList.add('solo');
    slideTX = 0;
    emailCard.style.transform = 'translate(-50%, -50%) scale(1)';
    return;
  }
  stageEl.classList.remove('solo');
  const gap = 16;
  slideTX = -(gap + emailCard.offsetWidth) / 2;
  const emX = (gap + cardEl.offsetWidth) / 2;
  emailCard.style.transform = `translate(calc(-50% + ${emX}px),-50%) scale(1)`;
};
let mailResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(mailResizeTimer);
  mailResizeTimer = setTimeout(layoutMail, 120);
});
const openMail = () => {
  if (mailOpen) {
    return;
  }
  mailOpen = true;
  sliding = true;
  setTimeout(() => (sliding = false), 650);
  emailCard.hidden = false;
  requestAnimationFrame(() => {
    layoutMail();
    emailCard.classList.add('open');
  });
  try {
    pop();
  } catch (_) {}
  if (!NARROW.matches) {
    setTimeout(() => mailName.focus(), 320);
  }
};
const closeMail = () => {
  if (!mailOpen) {
    return;
  }
  mailOpen = false;
  sliding = true;
  setTimeout(() => (sliding = false), 650);
  slideTX = 0;
  stageEl.classList.remove('solo');
  emailCard.style.transform = '';
  emailCard.classList.remove('open');
  clearTimeout(nameTimer);
  clearTimeout(checkTimer);
  clearTimeout(greetTimer);
  setTimeout(() => {
    if (mailOpen) {
      return;
    }
    emailCard.hidden = true;
    mailName.value = '';
    mailSubject.value = '';
    mailBody.value = '';
    [mailName, mailSubject, mailBody].forEach((el) => el.classList.remove('err'));
    nameSpin.hidden = true;
    nameLabel.textContent = 'Discord username';
    [mailSubject, mailBody, mailSend].forEach((el) => el.classList.remove('skeleton'));
    mailName.readOnly = false;
    mailSubject.readOnly = false;
    mailBody.readOnly = false;
    mailSend.disabled = false;
    emailForm.hidden = false;
    friendView.hidden = true;
  }, 560);
};
const sendMail = () => {
  const name = mailName.value.trim();
  if (isBlocked(name)) {
    denyAccess();
    return;
  }
  const subj = mailSubject.value.trim();
  const body = mailBody.value.trim();

  const missing = [
    [name, mailName],
    [subj, mailSubject],
    [body, mailBody],
  ]
    .filter((x) => !x[0])
    .map((x) => x[1]);
  if (missing.length) {
    missing.forEach((el) => {
      el.classList.remove('err');
      void el.offsetWidth;
      el.classList.add('err');
    });
    missing[0].focus();
    return;
  }
  const fullSubject = `${name} — ${subj}`;
  window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(body)}`;
  closeMail();
};
emailBtn.addEventListener('click', (e) => {
  e.preventDefault();
  mailOpen ? closeMail() : openMail();
});
mailClose.addEventListener('click', closeMail);
mailSend.addEventListener('click', sendMail);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mailOpen) {
    closeMail();
  }
});

mailBody.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    sendMail();
  }
});

const fieldTick = (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return;
  }
  if (e.key && e.key.length === 1 && e.key !== ' ') {
    typeTick();
  }
};
mailName.addEventListener('keydown', fieldTick);
mailSubject.addEventListener('keydown', fieldTick);
mailBody.addEventListener('keydown', fieldTick);
[mailName, mailSubject, mailBody].forEach((el) =>
  el.addEventListener('input', () => el.classList.remove('err')),
);

const enter = document.getElementById('enter');
const loadHint = document.getElementById('loadHint');
let entered = false;
let enterEnabled = false;
let enterQueued = false;

const enableEnter = () => {
  if (enterEnabled) {
    return;
  }
  enterEnabled = true;
  if (enterQueued) {
    go();
    return;
  }
  enter.classList.remove('loading');
  enter.classList.add('ready');
};

const requestEnter = () => {
  if (entered) {
    return;
  }
  initAudio();
  unlockAudio();
  if (enterEnabled) {
    go();
    return;
  }
  enterQueued = true;
  loadHint.textContent = 'starting\u2026';
};
const go = () => {
  initAudio();
  entered = true;
  enter.classList.add('gone');
  cardEl.classList.add('reveal');
  startPetals();
  wireSounds();
  blip(784, 1175);

  setTimeout(() => {
    cardEl.classList.remove('reveal');
    cardEl.style.opacity = '1';
    cardMotion = true;
    requestAnimationFrame(cardLoop);
    startReach();
  }, 1050);
  setTimeout(() => enter.remove(), 800);
  enter.removeEventListener('click', requestEnter);
};
enter.addEventListener('click', requestEnter);
