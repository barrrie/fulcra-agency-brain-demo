<script>
  import { onMount } from 'svelte';

  /**
   * A slowly turning field of memories on a canvas. Drag to turn, zoom from
   * outside via `zoom`, hover for a card, click to pin it.
   */
  let {
    memories = [],
    labels = [], // [{ name, count, colour, pos }]
    colourOf = () => '#56d6b7',
    highlight = null, // Set of memory ids, or null for all
    zoom = 1,
    resetKey = 0,
    pinned = $bindable(null)
  } = $props();

  let wrap;
  let canvas;
  let hovered = $state(null);
  let cardAt = $state({ x: 0, y: 0 });

  let yaw = 0.6;
  let pitch = -0.25;
  let spinning = true;
  let dragging = null;
  let size = { w: 800, h: 560 };
  let projected = [];
  // A drawing cache, not state.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const sprites = new Map();

  $effect(() => {
    resetKey;
    yaw = 0.6;
    pitch = -0.25;
    spinning = !reducedMotion();
  });

  function reducedMotion() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** One pre-rendered soft glow per colour; drawing images is far cheaper than gradients. */
  function sprite(colour) {
    if (sprites.has(colour)) return sprites.get(colour);
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, colour);
    grad.addColorStop(0.18, colour + 'cc');
    grad.addColorStop(0.45, colour + '33');
    grad.addColorStop(1, colour + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    sprites.set(colour, s);
    return s;
  }

  function project([x, y, z]) {
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw);
    const cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y1 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const f = 3.2;
    const scale = (f / (f + z2)) * Math.min(size.w, size.h) * 0.4 * zoom;
    return { x: size.w / 2 + x1 * scale, y: size.h / 2 - y1 * scale, depth: z2, scale };
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    projected = memories.map((m) => ({ m, ...project(m.pos) })).sort((a, b) => b.depth - a.depth);

    ctx.globalCompositeOperation = 'lighter';
    const glow = Math.min(1, Math.min(size.w, size.h) / 700);
    for (const p of projected) {
      const lit = !highlight || highlight.has(p.m.id);
      const near = 1 - (p.depth + 1.2) / 2.4; // 0 far … 1 near
      const r = (lit ? 22 : 12) * (0.7 + 0.5 * near) * Math.sqrt(zoom) * glow;
      ctx.globalAlpha = (lit ? 0.45 + 0.4 * near : 0.07) * (0.4 + 0.6 * glow);
      ctx.drawImage(sprite(colourOf(p.m)), p.x - r, p.y - r, r * 2, r * 2);
      // A faint wide halo so each region reads as a cloud, not loose dots.
      if (lit) {
        ctx.globalAlpha = 0.07 * glow;
        ctx.drawImage(sprite(colourOf(p.m)), p.x - r * 3, p.y - r * 3, r * 6, r * 6);
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    for (const p of projected) {
      if (highlight && !highlight.has(p.m.id)) continue;
      const active = p.m.id === hovered?.id || p.m.id === pinned?.id;
      ctx.globalAlpha = active ? 1 : 0.85;
      ctx.fillStyle = active ? '#ffffff' : colourOf(p.m);
      ctx.beginPath();
      ctx.arc(p.x, p.y, active ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.textBaseline = 'middle';
    // Labels nearest the viewer win; others step down until they stop overlapping.
    const boxes = [];
    const placed = labels.map((l) => ({ l, ...project(l.pos) })).sort((a, b) => a.depth - b.depth);
    for (const { l, x, y } of placed) {
      ctx.font = '500 14px Rubik, system-ui, sans-serif';
      const w = ctx.measureText(l.name).width;
      const count = String(l.count);
      const full = w + 8 + count.length * 7.5;
      let ly = y;
      for (let tries = 0; tries < 6; tries++) {
        const hit = boxes.some(
          (b) => Math.abs(b.x - x) < (b.w + full) / 2 + 6 && Math.abs(b.y - ly) < 18
        );
        if (!hit) break;
        ly += tries % 2 ? -18 * (tries + 1) : 18 * (tries + 1);
      }
      boxes.push({ x, y: ly, w: full });
      ctx.shadowColor = 'rgba(8, 12, 18, 0.95)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = l.colour;
      ctx.fillText(l.name, x - full / 2, ly);
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(count, x - full / 2 + w + 8, ly + 1);
      ctx.shadowBlur = 0;
    }
  }

  function nearest(x, y) {
    let best = null;
    let bestD = 14 * 14;
    for (let i = projected.length - 1; i >= 0; i--) {
      const p = projected[i];
      if (highlight && !highlight.has(p.m.id)) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) [best, bestD] = [p, d];
    }
    return best;
  }

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e) {
    canvas.setPointerCapture(e.pointerId);
    dragging = { ...local(e), moved: false };
    spinning = false;
  }

  function onMove(e) {
    const pt = local(e);
    if (dragging) {
      const dx = pt.x - dragging.x;
      const dy = pt.y - dragging.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragging.moved = true;
      yaw += dx * 0.008;
      pitch = Math.max(-1.4, Math.min(1.4, pitch + dy * 0.008));
      dragging.x = pt.x;
      dragging.y = pt.y;
      hovered = null;
      return;
    }
    const hit = nearest(pt.x, pt.y);
    hovered = hit?.m ?? null;
    if (hit) cardAt = { x: hit.x, y: hit.y };
  }

  function onUp(e) {
    const wasClick = dragging && !dragging.moved;
    dragging = null;
    if (!wasClick) return;
    const pt = local(e);
    const hit = nearest(pt.x, pt.y);
    pinned = hit && hit.m.id !== pinned?.id ? hit.m : null;
  }

  // Where the pinned card sits follows the point as the field turns.
  const shown = $derived(pinned ?? hovered);
  let pinnedAt = $state({ x: 0, y: 0 });

  onMount(() => {
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      size = { w: r.width, h: r.height };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    });
    ro.observe(wrap);
    spinning = !reducedMotion();

    let raf;
    const tick = () => {
      if (spinning) yaw += 0.0012;
      draw();
      if (pinned) {
        const p = project(pinned.pos);
        pinnedAt = { x: p.x, y: p.y };
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });

  const at = $derived(pinned ? pinnedAt : cardAt);
  // Keep the card inside the field, flipping to the other side of the point near an edge.
  const cardW = $derived(Math.min(320, size.w - 16));
  const cardLeft = $derived.by(() => {
    const left = at.x > size.w - cardW - 24 ? at.x - cardW - 16 : at.x + 16;
    return Math.max(8, Math.min(left, size.w - cardW - 8));
  });
  const flipY = $derived(at.y > size.h - 170);
</script>

<div bind:this={wrap} class="relative h-full w-full">
  <canvas
    bind:this={canvas}
    class="block h-full w-full touch-none select-none"
    style:cursor={hovered ? 'pointer' : 'grab'}
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointerleave={() => (hovered = null)}
    aria-label="Map of memories. The list below has the same memories as text."
  ></canvas>

  {#if shown}
    <div
      class="absolute z-10 rounded-xl border border-white/10 bg-[#0f1820]/95 p-4 shadow-2xl backdrop-blur"
      class:pointer-events-none={!pinned}
      style:width={`${cardW}px`}
      style:left={`${cardLeft}px`}
      style:top={`${flipY ? at.y - 150 : at.y + 12}px`}
    >
      <div class="mb-2 flex items-center gap-2 text-xs text-fulcra-gray">
        <span class="h-2 w-2 shrink-0 rounded-full" style:background={colourOf(shown)}></span>
        <span class="truncate"
          >{shown.clientName} · {shown.section}{shown.heading ? ` · ${shown.heading}` : ''}</span
        >
      </div>
      <p class="text-sm leading-snug text-fulcra-white">{shown.text}</p>
      {#if pinned}
        <div class="mt-3 flex items-center justify-between text-xs">
          <a
            class="text-fulcra-teal hover:underline"
            href={`/clients/${shown.client}?section=${shown.file}`}
          >
            Open in {shown.clientName}'s brain
          </a>
          <button class="text-fulcra-gray hover:text-fulcra-white" onclick={() => (pinned = null)}
            >Close</button
          >
        </div>
      {/if}
    </div>
  {/if}
</div>
