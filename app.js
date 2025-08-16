(() => {
  const coin = document.getElementById('coin');
  const wrapper = document.getElementById('coinWrapper');
  const againBtn = document.getElementById('againBtn');
  const resultEl = document.getElementById('result');

  // ====== SFX / HAPTIC ======
  const SFX_MASTER = 0.25; // общая громкость (0..1)
  let audioCtx = null;
  let spinSource = null;     // текущий шум «whoosh»
  let spinGain = null;

  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { audioCtx = null; }
    }
    return audioCtx;
  }

  // Лёгкий хаптик (универсальная обёртка)
  const tg = window.Telegram?.WebApp ?? null;
  const hf = tg?.HapticFeedback ?? null;

  function hapticImpact(style = 'light') {
    if (hf?.impactOccurred) { hf.impactOccurred(style); return; }
    if (navigator.vibrate)     navigator.vibrate(style === 'heavy' ? 25 : 12);
  }
  function hapticSelection() {
    if (hf?.selectionChanged) { hf.selectionChanged(); return; }
    if (navigator.vibrate)     navigator.vibrate(8);
  }
  function hapticNotify(type = 'success') {
    if (hf?.notificationOccurred) { hf.notificationOccurred(type); return; }
    if (navigator.vibrate) {
      if (type === 'success') navigator.vibrate([20, 30, 20]);
      else if (type === 'error') navigator.vibrate([40, 60, 40]);
      else navigator.vibrate(15);
    }
  }

  // Шумовой «whoosh» на время спина
  function playSpinWhoosh(ms) {
    const ctx = ensureAudio(); if (!ctx) return;
    stopSpinWhoosh();
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * (ms / 1000)));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // белый шум -> фильтр
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    // Фильтр, чтобы звук был мягче
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 4000;

    const gain = ctx.createGain();
    gain.gain.value = 0.0;

    src.connect(hp); hp.connect(lp); lp.connect(gain); gain.connect(ctx.destination);

    const now = ctx.currentTime;
    // Атака/поддержание/спад под длительность
    gain.gain.linearRampToValueAtTime(SFX_MASTER * 0.45, now + 0.08);
    gain.gain.setTargetAtTime(SFX_MASTER * 0.35, now + 0.2, 0.3);
    gain.gain.setTargetAtTime(0.0001, now + (ms / 1000) - 0.12, 0.08);

    src.start();
    spinSource = src; spinGain = gain;

    // Автоочистка
    setTimeout(stopSpinWhoosh, ms + 200);
  }
  function stopSpinWhoosh() {
    try {
      if (spinGain) { spinGain.gain.cancelScheduledValues(0); spinGain.gain.setValueAtTime(spinGain.gain.value, audioCtx?.currentTime ?? 0); spinGain.gain.exponentialRampToValueAtTime(0.0001, (audioCtx?.currentTime ?? 0) + 0.05); }
      if (spinSource) spinSource.stop();
    } catch {}
    spinSource = null; spinGain = null;
  }

  // Финальный «дзынь»
  function playDing(success = true) {
    const ctx = ensureAudio(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;

    // Ноты: повыше для «ДА», пониже — «НЕТ»
    const base = success ? 880 : 740; // Гц
    osc.frequency.value = base;
    osc2.frequency.value = base * 1.5;

    osc.type = 'sine'; osc2.type = 'triangle';

    osc.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const dur = 0.35;
    gain.gain.linearRampToValueAtTime(SFX_MASTER * 0.6, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.start(now); osc2.start(now);
    osc.stop(now + dur); osc2.stop(now + dur + 0.02);
  }

  // ====== ВИЗУАЛ/ФИЗИКА ======
  let rotation = { x: 0, y: 0, z: 0 };
  let spinning = false;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const randRange = (a, b) => a + Math.random() * (b - a);

  function applyTransform() {
    coin.style.transform =
      `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`;
  }

  function makeSpinPlan(totalMs, resultFace) {
    const dur1 = totalMs * 0.35;
    const dur2 = totalMs * 0.40;
    const dur3 = totalMs - dur1 - dur2;

    const s1 = { x: randRange(720, 1200) * (Math.random() < 0.5 ? 1 : -1),
                 y: randRange(720, 1200),
                 z: randRange(120, 360) * (Math.random() < 0.5 ? 1 : -1) };

    const s2 = { x: randRange(360, 900) * (Math.random() < 0.5 ? 1 : -1),
                 y: randRange(900, 1440) * (Math.random() < 0.5 ? 1 : -1),
                 z: randRange(120, 480) };

    const s3 = { x: randRange(180, 540),
                 y: randRange(180, 540) * (Math.random() < 0.5 ? 1 : -1),
                 z: randRange(60, 180) };

    const snap = resultFace === 'yes' ? { x: 0, y: 0 } : { x: 0, y: 180 };

    return { segs: [
      { dur: dur1, speed: s1, easeIn: true,  easeOut: false },
      { dur: dur2, speed: s2, easeIn: false, easeOut: false },
      { dur: dur3, speed: s3, easeIn: false, easeOut: true  }
    ], snap };
  }

  function startSpin() {
    if (spinning) return;
    spinning = true;
    coin.classList.add('spinning');
    againBtn.hidden = true;
    resultEl.textContent = '...';

    // Аудио/хаптик старт
    hapticImpact('light');
    playSpinWhoosh(randRange(3200, 3800)); // длительность подберём точно ниже

    const result = Math.random() < 0.5 ? 'yes' : 'no';
    const totalMs = Math.round(randRange(3200, 3800)); // 3–4 сек
    const plan = makeSpinPlan(totalMs, result);

    const t0 = performance.now();
    let segIndex = 0;
    let prevTime = t0;

    rotation.z += randRange(-8, 8); // лёгкая стартовая вариация
    // Нежная вибрация на протяжении спина (fallback)
    const vibId = setInterval(() => hapticSelection(), 350);

    const frame = (now) => {
      const dt = now - prevTime; prevTime = now;
      const elapsed = now - t0;
      const seg = plan.segs[segIndex] || plan.segs[plan.segs.length - 1];
      const segStart = plan.segs.slice(0, segIndex).reduce((s, it) => s + it.dur, 0);
      const segT = clamp((elapsed - segStart) / seg.dur, 0, 1);

      const localEase =
        seg.easeIn ? easeInOutCubic(segT) :
        seg.easeOut ? easeInOutCubic(segT) :
        segT;

      const jitterX = Math.sin((elapsed / 130) + segIndex) * 20;
      const jitterY = Math.cos((elapsed / 170) + segIndex * 1.7) * 25;
      const jitterZ = Math.sin((elapsed / 210) + segIndex * 2.3) * 8;

      rotation.x += (seg.speed.x + jitterX) * (dt / 1000) * (seg.easeIn ? lerp(0.4, 1.0, localEase) : 1);
      rotation.y += (seg.speed.y + jitterY) * (dt / 1000) * (seg.easeOut ? lerp(1.0, 0.35, localEase) : 1);
      rotation.z += (seg.speed.z + jitterZ) * (dt / 1000);

      applyTransform();

      if (segT >= 1 && segIndex < plan.segs.length - 1) segIndex++;

      if (elapsed < plan.segs.reduce((s, it) => s + it.dur, 0)) {
        requestAnimationFrame(frame);
      } else {
        const snapStart = { x: rotation.x % 360, y: rotation.y % 360, z: rotation.z % 360 };
        const target = {
          x: Math.round(snapStart.x / 360) * 360 + plan.snap.x,
          y: Math.round(snapStart.y / 360) * 360 + plan.snap.y,
          z: snapStart.z
        };
        const snapMs = 300;
        const tSnap0 = performance.now();

        const snapFrame = (n) => {
          const tt = clamp((n - tSnap0) / snapMs, 0, 1);
          const e = easeInOutCubic(tt);

          rotation.x = lerp(snapStart.x, target.x, e);
          rotation.y = lerp(snapStart.y, target.y, e);
          rotation.z = lerp(snapStart.z, target.z, e);
          applyTransform();

          if (tt < 1) {
            requestAnimationFrame(snapFrame);
          } else {
            spinning = false;
            coin.classList.remove('spinning');
            againBtn.hidden = false;

            const success = result === 'yes';
            resultEl.textContent = success ? 'ДА' : 'НЕТ';

            // Стоп эффектов
            clearInterval(vibId);
            stopSpinWhoosh();
            playDing(success);
            hapticNotify(success ? 'success' : 'error');
          }
        };
        requestAnimationFrame(snapFrame);
      }
    };
    requestAnimationFrame(frame);
  }

  function resetAndSpin() {
    if (spinning) return;
    rotation = { x: randRange(-10, 10), y: randRange(-10, 10), z: randRange(-5, 5) };
    applyTransform();
    startSpin();
  }

  // events
  wrapper.addEventListener('click', startSpin);
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startSpin(); }
  });
  againBtn.addEventListener('click', resetAndSpin);

  // стартовая поза
  applyTransform();

  // Разрешение аудио после первого взаимодействия (политики браузера)
  ['click','keydown','touchstart'].forEach(evt => {
    window.addEventListener(evt, () => ensureAudio(), { once: true, passive: true });
  });
})();
