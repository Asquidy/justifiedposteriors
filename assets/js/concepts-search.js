/**
 * Concepts semantic search (client-side, no backend).
 *
 * - Instant substring filter works immediately.
 * - On first focus, lazily loads transformers.js + a MiniLM embedding model,
 *   embeds all concepts once (cached in localStorage), then ranks tiles by
 *   semantic similarity to the query and reorders them best-match-first.
 *
 * Corpus = concept name + definition + field (built into #concepts-data by Jekyll).
 */

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
const MODEL = 'Xenova/all-MiniLM-L6-v2';
const CACHE_KEY = 'jp-concept-vecs-v1';
const MIN_SCORE = 0.22;   // hide concepts below this similarity once a query is entered
const MIN_RESULTS = 6;    // ...but always show at least this many top matches

const input = document.getElementById('concept-search');
const container = document.getElementById('concept-table');
const noResults = document.getElementById('concept-no-results');
const statusEl = document.getElementById('concept-search-status');

if (input && container) {
  const rows = Array.from(container.querySelectorAll('.belief-row'));
  const originalOrder = rows.slice();
  const texts = JSON.parse(document.getElementById('concepts-data').textContent);

  let extractor = null;       // the embedding pipeline
  let conceptVecs = null;     // Float32Array[] aligned to row order
  let modelState = 'idle';    // idle | loading | ready | error
  let debounce = null;

  function setStatus(html) {
    if (statusEl) statusEl.innerHTML = html;
  }

  function restoreOrder() {
    originalOrder.forEach((r) => container.appendChild(r));
  }

  // --- Instant fallback: substring filter, original order ---
  function substringFilter(q) {
    const query = q.toLowerCase().trim();
    let visible = 0;
    rows.forEach((r) => {
      const match = query === '' || r.textContent.toLowerCase().includes(query);
      r.classList.toggle('belief-row--hidden', !match);
      if (match) visible++;
    });
    restoreOrder();
    if (noResults) noResults.hidden = visible > 0 || query === '';
  }

  // --- Semantic ranking ---
  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  async function semanticSearch(q) {
    const query = q.trim();
    if (query === '') { substringFilter(''); return; }
    const out = await extractor(query, { pooling: 'mean', normalize: true });
    const qvec = out.data; // normalized -> cosine == dot product

    const scored = rows.map((r, i) => ({ r, score: dot(qvec, conceptVecs[i]) }));
    scored.sort((a, b) => b.score - a.score);

    let visible = 0;
    scored.forEach(({ r, score }, rank) => {
      const show = score >= MIN_SCORE || rank < MIN_RESULTS;
      r.classList.toggle('belief-row--hidden', !show);
      if (show) visible++;
      container.appendChild(r); // reorder: best matches first
    });
    if (noResults) noResults.hidden = visible > 0;
  }

  // --- Lazy model + concept embeddings ---
  async function embedConcepts() {
    // Try cache (invalidated by concept count, since text changes with the data)
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && cached.n === texts.length && Array.isArray(cached.vecs)) {
        return cached.vecs.map((v) => Float32Array.from(v));
      }
    } catch (e) { /* ignore corrupt cache */ }

    const out = await extractor(texts, { pooling: 'mean', normalize: true });
    const dim = out.dims[out.dims.length - 1];
    const flat = out.data;
    const vecs = [];
    for (let i = 0; i < texts.length; i++) {
      vecs.push(flat.slice(i * dim, (i + 1) * dim));
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        n: texts.length,
        vecs: vecs.map((v) => Array.from(v)),
      }));
    } catch (e) { /* storage full / unavailable — fine, recompute next time */ }
    return vecs;
  }

  async function ensureModel() {
    if (modelState === 'ready' || modelState === 'loading') return;
    modelState = 'loading';
    setStatus('<span class="concept-search-hint__loading">Loading semantic search… (one-time model download)</span>');
    try {
      const { pipeline, env } = await import(TRANSFORMERS_CDN);
      env.allowLocalModels = false;
      extractor = await pipeline('feature-extraction', MODEL);
      conceptVecs = await embedConcepts();
      modelState = 'ready';
      setStatus('<span class="concept-search-hint__ready">✨ Semantic search ready — results ranked by meaning.</span>');
      if (input.value.trim() !== '') semanticSearch(input.value);
    } catch (e) {
      console.error('Semantic search failed to load:', e);
      modelState = 'error';
      setStatus('<span class="concept-search-hint__error">Semantic search unavailable — using text filter.</span>');
    }
  }

  // Warm up the model as soon as the user engages with the box.
  input.addEventListener('focus', ensureModel, { once: true });

  input.addEventListener('input', function () {
    const q = this.value;
    if (modelState === 'ready') {
      clearTimeout(debounce);
      debounce = setTimeout(() => semanticSearch(q), 180);
    } else {
      substringFilter(q); // instant, while (or if) the model loads
    }
  });
}
