/**
 * Turns client brains into a map: every bullet, table row or paragraph is one
 * "memory", memories are grouped into regions by what they say (TF-IDF +
 * spherical k-means), and each memory gets a 3D position near the regions it
 * resembles. Pure and deterministic, so the same brains always draw the same map.
 */

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are aren as at be because been before being below
  between both but by can could did do does doing don down during each few for from further get gets got had has
  have having he her here hers him his how i if in into is isn it its itself just let like make me more most much
  must my no nor not now of off on once one only or other our ours out over own per same she should so some such
  than that the their theirs them then there these they this those through to too under until up us very via was
  we were what when where which while who whom why will with within without would yes yet you your new two three
  first last next only still well way ways thing things lot lots sure get use used using week weeks weekly month
  months day days oct sep aug jul jun nov dec jan feb mar apr may 2024 2025 2026 2027 client clients brain brains
  confirmed unconfirmed open set example demo placeholder placeholders note notes line lines see per vs etc who's what's it's don't can't won't`.split(
    /\s+/
  )
);

const SECTION_WEIGHT = 2.5;

/** Small deterministic PRNG (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Strip inline markdown so a memory reads as plain text. */
function plain(text) {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split one brain file into memories. Headings give context; the H1 title,
 * frontmatter and table furniture are dropped. Indented continuation lines
 * join the bullet above them.
 */
export function chunkMarkdown(markdown) {
  const out = [];
  if (!markdown) return out;
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n?/, '');
  let heading = null;
  let tableHeader = null;
  let last = null;

  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      last = null;
      tableHeader = null;
      continue;
    }
    if (/^#\s/.test(trimmed)) continue;
    const h = trimmed.match(/^#{2,6}\s+(.*)$/);
    if (h) {
      heading = plain(h[1]);
      last = null;
      tableHeader = null;
      continue;
    }
    if (trimmed.startsWith('|')) {
      const cells = trimmed
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => plain(c));
      if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) continue;
      if (!tableHeader) {
        tableHeader = cells;
        continue;
      }
      last = { heading, text: cells.filter(Boolean).join(' · ') };
      out.push(last);
      continue;
    }
    const item = trimmed.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (item) {
      last = { heading, text: plain(item[1]) };
      out.push(last);
      continue;
    }
    if (last && /^\s{2,}/.test(line)) {
      last.text = plain(`${last.text} ${trimmed}`);
      continue;
    }
    last = { heading, text: plain(trimmed) };
    out.push(last);
  }
  return out.filter((m) => m.text.length > 2);
}

function tokens(text, extraStop) {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])
    .map((w) => w.replace(/^'+|'+$/g, '').replace(/'s$/, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !extraStop.has(w));
}

/** Light stemming so "comment" and "comments" land together. */
function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function normalize(v) {
  let n = 0;
  for (const x of v.values()) n += x * x;
  n = Math.sqrt(n) || 1;
  for (const [k, x] of v) v.set(k, x / n);
  return v;
}

function dot(a, b) {
  let s = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const [k, x] of small) {
    const y = big.get(k);
    if (y) s += x * y;
  }
  return s;
}

/** Top three eigenvectors of a small symmetric matrix (power iteration + deflation). */
function topEigen(M, count, rand) {
  const n = M.length;
  const A = M.map((r) => r.slice());
  const vecs = [];
  for (let c = 0; c < count; c++) {
    let v = Array.from({ length: n }, () => rand() - 0.5);
    let lambda = 0;
    for (let it = 0; it < 200; it++) {
      const w = A.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
      const norm = Math.hypot(...w) || 1;
      lambda = norm;
      v = w.map((x) => x / norm);
    }
    vecs.push({ v, lambda });
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) A[i][j] -= lambda * v[i] * v[j];
  }
  return vecs;
}

/**
 * Build the map.
 * @param {{client: string, clientName: string, file: string, section: string, heading: string|null, text: string}[]} memories
 * @param {{seed?: number, regions?: number, stopwords?: string[]}} [opts]
 */
export function buildMap(memories, opts = {}) {
  const rand = rng(opts.seed ?? 7);
  const extraStop = new Set(
    (opts.stopwords || []).flatMap((s) => s.toLowerCase().split(/[^a-z]+/)).filter(Boolean)
  );
  const n = memories.length;
  if (!n) return { regions: [], memories: [] };

  // Term frequencies. The heading counts once so a bullet keeps its section's sense.
  const surface = new Map();
  const docs = memories.map((m) => {
    const tf = new Map();
    for (const w of [...tokens(m.text, extraStop), ...tokens(m.heading || '', extraStop)]) {
      const s = stem(w);
      tf.set(s, (tf.get(s) || 0) + 1);
      const forms = surface.get(s) || new Map();
      forms.set(w, (forms.get(w) || 0) + 1);
      surface.set(s, forms);
    }
    return tf;
  });
  const df = new Map();
  for (const tf of docs) for (const k of tf.keys()) df.set(k, (df.get(k) || 0) + 1);
  // Short bullets share few words, so the file they came from (people, log,
  // guardrails…) rides along as one extra feature. It never names a region.
  const vecs = docs.map((tf, i) => {
    const v = new Map();
    for (const [k, c] of tf) {
      const d = df.get(k);
      if (d < 2 || d > Math.max(n * 0.4, 5)) continue;
      v.set(k, (1 + Math.log(c)) * Math.log(n / d));
    }
    v.set(`\u0000${memories[i].file}`, SECTION_WEIGHT);
    return normalize(v);
  });

  // Spherical k-means with k-means++ seeding.
  const k = Math.max(1, Math.min(opts.regions ?? Math.round(Math.sqrt(n / 2)), 12, n));
  const live = vecs.map((v, i) => i).filter((i) => vecs[i].size);
  const pool = live.length >= k ? live : vecs.map((v, i) => i);
  let centroids = [vecs[pool[Math.floor(rand() * pool.length)]]];
  while (centroids.length < k) {
    const d = pool.map((i) => 1 - Math.max(...centroids.map((c) => dot(vecs[i], c))));
    const total = d.reduce((s, x) => s + x * x, 0);
    let r = rand() * total;
    let pick = pool[pool.length - 1];
    for (let j = 0; j < pool.length; j++) {
      r -= d[j] * d[j];
      if (r <= 0) {
        pick = pool[j];
        break;
      }
    }
    centroids.push(new Map(vecs[pick]));
  }
  let assign = new Array(n).fill(0);
  for (let it = 0; it < 30; it++) {
    const next = vecs.map((v) => {
      let best = 0;
      let bestSim = -1;
      centroids.forEach((c, j) => {
        const s = dot(v, c);
        if (s > bestSim) [best, bestSim] = [j, s];
      });
      return best;
    });
    const changed = next.some((a, i) => a !== assign[i]);
    assign = next;
    centroids = centroids.map((old, j) => {
      const sum = new Map();
      vecs.forEach((v, i) => {
        if (assign[i] !== j) return;
        for (const [t, x] of v) sum.set(t, (sum.get(t) || 0) + x);
      });
      return sum.size ? normalize(sum) : old;
    });
    if (!changed && it > 0) break;
  }

  // Drop empty regions, then order by size.
  const used = [...new Set(assign)];
  const sizes = used.map((j) => assign.filter((a) => a === j).length);
  const order = used.map((j, i) => ({ j, size: sizes[i] })).sort((a, b) => b.size - a.size);
  const remap = new Map(order.map((o, i) => [o.j, i]));
  centroids = order.map((o) => centroids[o.j]);
  assign = assign.map((a) => remap.get(a));

  // Name each region after its strongest term (most common spelling), unless
  // most of it sits under one shared heading, which reads better.
  const bestForm = (s) =>
    [...(surface.get(s) || new Map([[s, 1]]))].sort((a, b) => b[1] - a[1])[0][0];
  const taken = new Set();
  const regions = centroids.map((c, i) => {
    const terms = [...c]
      .filter(([t]) => !t.startsWith('\u0000'))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([t]) => bestForm(t));
    const members = memories.filter((m, idx) => assign[idx] === i);
    const headings = new Map();
    for (const m of members)
      if (m.heading) headings.set(m.heading, (headings.get(m.heading) || 0) + 1);
    const [topHeading, hits] = [...headings].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    let name =
      hits >= Math.max(3, members.length * 0.4) && topHeading.length <= 24
        ? topHeading
        : terms[0] || 'Other';
    if (taken.has(name) && terms[1]) name = `${name} & ${terms[1]}`;
    taken.add(name);
    return {
      id: i,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      terms,
      count: assign.filter((a) => a === i).length
    };
  });

  // Region centres: classical MDS over centroid distances, so alike regions sit close.
  const R = centroids.length;
  const D2 = centroids.map((a) => centroids.map((b) => 2 - 2 * dot(a, b)));
  const rowMean = D2.map((r) => r.reduce((s, x) => s + x, 0) / R);
  const all = rowMean.reduce((s, x) => s + x, 0) / R;
  const B = D2.map((r, i) => r.map((x, j) => -0.5 * (x - rowMean[i] - rowMean[j] + all)));
  const eig = topEigen(B, 3, rand);
  let centres = centroids.map((_, i) =>
    eig.map((e) => e.v[i] * Math.sqrt(Math.max(e.lambda, 1e-6)))
  );
  // Unrelated regions all sit at the same distance in MDS; spread them so labels don't stack.
  const spread = Math.max(...centres.map((c) => Math.hypot(...c)), 1e-6);
  centres = centres.map((c, i) => {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const y = R === 1 ? 0 : 1 - (i / (R - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const fib = [Math.cos(golden * i) * r, y, Math.sin(golden * i) * r];
    return c.map((x, d) => 0.4 * (x / spread) + 0.75 * fib[d]);
  });
  const radius = Math.max(...centres.map((c) => Math.hypot(...c)), 1e-6);
  centres = centres.map((c) => c.map((x) => x / radius));
  regions.forEach((r, i) => (r.centre = centres[i].map((x) => +x.toFixed(4))));

  // Each memory sits at a similarity-weighted blend of region centres, plus scatter.
  const gauss = (r) => {
    const u = Math.max(r(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
  const placed = memories.map((m, i) => {
    const sims = centroids.map((c) => dot(vecs[i], c));
    const own = assign[i];
    const weights = sims.map((s, j) => Math.exp(8 * (s - sims[own])) * (j === own ? 3 : 1));
    const wsum = weights.reduce((s, x) => s + x, 0);
    const pos = [0, 1, 2].map((d) => weights.reduce((s, w, j) => s + w * centres[j][d], 0) / wsum);
    const local = rng(hash(`${m.client}/${m.file}/${i}/${m.text}`));
    const tight = 0.1 + 0.12 * (1 - Math.min(1, sims[own] * 1.5));
    return {
      id: i,
      region: own,
      client: m.client,
      clientName: m.clientName,
      file: m.file,
      section: m.section,
      heading: m.heading,
      text: m.text,
      pos: pos.map((x) => +(x + gauss(local) * tight).toFixed(4))
    };
  });

  return { regions, memories: placed };
}
