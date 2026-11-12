import {
  buildout, capexComparison, COMPARISONS, DEFAULTS, financing, gpuRentProfile, gpuRevenue,
  LEASE_LEVERAGE, LIMITS, normalize, PIPELINE, PRESETS, revenue,
} from './model.js';
import { COLORS, legend, plotGpuRent, plotRevenue, plotSpend } from './charts.js';

const $ = selector => document.querySelector(selector);
const storageKey = 'ai-buildout-lab/scenario-v2';
const legacyStorageKey = 'ai-buildout-lab/scenario-v1';
const beliefsKey = 'ai-buildout-lab/beliefs-v1';
const paper = 'https://papers.ssrn.com/sol3/Delivery.cfm?abstractid=6444363&mirid=1&type=2';
const discussion = 'https://www.brookings.edu/wp-content/uploads/2026/07/es_20260925_bpea_ai_transcript.pdf';
const lustig = 'https://thetwocents.substack.com/p/nine-percent-of-gdp';
const azhar = `${lustig}/comments?triedRedirect=true`;
const a16z = 'https://x.com/a16z/status/2120592662353121405';
const a16zCharts = 'https://www.a16z.news/p/charts-of-the-week-attention-is-all';
const ornn = 'https://data.ornn.com/methodology';
const number = (value, digits = 1) => value.toLocaleString('en-US', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const money = (value, digits = 2) => `$${number(value / 1000, digits)}T`;
const billions = value => `$${number(value, 0)}B`;
const pct = (value, digits = 0) => `${number(value, digits)}%`;
const signedMoney = value => `${value < 0 ? '−' : '+'}${money(Math.abs(value))}`;
const link = (url, label) => `<a href="${url}" target="_blank" rel="noopener">${label} ↗</a>`;
const tone = value => value < 0 ? 'negative' : 'positive';

function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function saveStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}

function sharedSettings() {
  try {
    const raw = new URLSearchParams(location.search).get('scenario');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savedSettings() {
  const current = readStorage(storageKey);
  if (current) return current;
  const prior = readStorage(legacyStorageKey);
  if (!prior) return null;
  // Carry forward edits while replacing the former Brookings defaults.
  return {
    ...prior,
    undatedEarly: prior.undatedEarly === 59.7 ? DEFAULTS.undatedEarly : prior.undatedEarly,
    undatedLate: prior.undatedLate === 100.6 ? DEFAULTS.undatedLate : prior.undatedLate,
  };
}

let settings = normalize(sharedSettings() ?? savedSettings());
let beliefs = readStorage(beliefsKey) ?? {};
const viewsByHash = { '#gpu-value': 'gpu', '#buildout': 'buildout' };
let view = viewsByHash[location.hash] ?? 'revenue';
let chartMarginAt;
let notifyTimer;

const fieldSpecs = {
  margin: ['Operating cash-flow margin', '%', 1],
  itLife: ['GPU economic life', 'yrs', 1],
  rentHold: ['Years at starting rent', 'yrs', 1, 'The annual change begins after this many years in service.'],
  rentChange: ['Annual rent change after hold', '%', 1, 'Use a negative value to model falling rents.'],
  gpuResale: ['Net resale at retirement', '%', 1, 'Percentage of original IT cost, received at the end of the GPU economic life.'],
  returnRate: ['Target unlevered return', '%', 0.5],
  utilization: ['Billed GPU utilization', '%', 1],
  demand: ['2032 revenue scenario', '$T', 0.1, 'Annual sales assumption for comparison with the hurdle.'],
  price: ['Achievable billed GPU price', '$/h', 0.1],
  itShare: ['IT share of project cost', '%', 1],
  otherLife: ['Non-IT economic life', 'yrs', 1],
  marketBase: ['2026 revenue starting point', '$T', 0.01, 'Use revenue for the market you want to compare. The paper cites $0.1T for two model developers.'],
  denominator: ['Custom 2032 GDP denominator', '$T', 0.1, 'Enter 0 to use modeled U.S. GDP.'],
  undatedEarly: ['Undated capacity online by 2032', 'GW', 0.1, '54.0 GW of the 313.9 GW undated pipeline in the paper.'],
  undatedLate: ['Undated capacity online after 2032', 'GW', 0.1, '89.8 GW in the paper. The remaining undated capacity is canceled or downsized.'],
  unitCost: ['2025 build cost per MW', '$M', 0.5],
  costGrowth: ['Annual build cost growth', '%', 0.5],
  gdpGrowth: ['Annual nominal U.S. GDP growth', '%', 0.5],
  spendExclusion: ['Share of modeled spend to exclude', '%', 1, 'Treat this share of modeled spending as other uses. The same adjustment reduces the capital cost for the selected capacity.'],
  companyAiShare: ['AI data center share of big-seven capex', '%', 1, 'Applies to the seven firms’ cited capex totals. The rest appears as Big-seven other.'],
  outside2025: ['Additional 2025 U.S. AI capex', '$B', 1, 'Enter spending by project vehicles and other owners outside the seven-firm comparison.'],
  outside2026: ['Additional 2026 U.S. AI capex', '$B', 1],
  externalFunding: ['Outside share of buildout funding', '%', 1, 'Applies to all modeled investment from 2025 to 2032.'],
  valueHaircut: ['Project value decline', '%', 1],
  leverage: ['Project debt / initial value', '%', 1],
  guaranteeShare: ['Share of decline covered by tenant', '%', 1],
  guaranteeCap: ['Guarantee cap / initial value', '%', 1],
  tenantEquity: ['Tenant ownership of project equity', '%', 1],
  collectability: ['Guarantee collectability', '%', 1],
  lenderExposure: ['Lender losses held by institutions', '%', 1, 'Share borne by lenders and insurers outside the tech sector.'],
  shortDebt: ['Short-term share of project debt', '%', 1],
};

const controlGroups = {
  revenue: {
    main: ['margin', 'itLife', 'returnRate', 'utilization', 'demand'],
    more: ['price', 'itShare', 'otherLife', 'marketBase', 'denominator'],
    label: 'Demand and capital assumptions',
  },
  gpu: {
    main: ['itLife', 'rentHold', 'rentChange', 'gpuResale'],
    more: ['returnRate', 'margin', 'utilization', 'itShare', 'otherLife'],
    label: 'Return, utilization, and asset mix',
  },
  buildout: {
    main: ['spendExclusion', 'companyAiShare', 'undatedEarly', 'undatedLate', 'unitCost', 'costGrowth'],
    more: ['gdpGrowth', 'outside2025', 'outside2026'],
    label: 'Spending and capex comparison',
  },
  financing: {
    main: ['externalFunding', 'valueHaircut', 'leverage', 'guaranteeShare', 'guaranteeCap'],
    more: ['tenantEquity', 'collectability', 'lenderExposure', 'shortDebt'],
    label: 'Ownership and creditor exposure',
  },
};

const rentPresets = [
  { id: 'flat', label: 'Flat rents', hold: 1, change: 0 },
  { id: 'hold', label: '2 years flat, then −10%', hold: 2, change: -10 },
  { id: 'fall', label: '−25% from year 2', hold: 1, change: -25 },
];

function field(key) {
  const [name, unit, step, hint] = fieldSpecs[key];
  const [min, max] = LIMITS[key];
  const description = hint ? `aria-describedby="${key}-hint"` : '';
  return `<div class="field">
    <div class="field-head"><label for="${key}">${name}</label>
      <span class="number"><input type="number" id="${key}" data-key="${key}" min="${min}" max="${max}" step="${step}" ${description}><span>${unit}</span></span>
    </div>
    <input type="range" data-key="${key}" aria-label="${name} (${unit})" min="${min}" max="${max}" step="${step}" ${description}>
    ${hint ? `<small id="${key}-hint" class="hint">${hint}</small>` : ''}
  </div>`;
}

function renderControls() {
  const panel = $('#controls');
  $('#tabs').querySelectorAll('button').forEach(tab =>
    tab.setAttribute('aria-pressed', String(tab.dataset.view === view)));
  panel.hidden = view === 'notes';
  $('.workspace').classList.toggle('notes', panel.hidden);
  if (panel.hidden) return;
  panel.classList.add('panel');
  const { main, more, label } = controlGroups[view];
  const shortcuts = view === 'gpu' ? `<div class="presets rent-presets" aria-label="Illustrative rental scenarios">
    ${rentPresets.map(preset => `<button type="button" class="preset" data-rent-preset="${preset.id}" aria-pressed="false">${preset.label}</button>`).join('')}
    </div>` : '';
  panel.innerHTML = `<div class="section-head"><h2 id="controls-title">Assumptions</h2><button type="button" class="reset" id="reset">Reset all</button></div>
    ${shortcuts}<div id="control-fields">${main.map(field).join('')}<details><summary>${label}</summary>${more.map(field).join('')}</details></div>`;
  syncControls();
}

function syncControls(except) {
  const round = value => Number(value.toFixed(4));
  $('#controls').querySelectorAll('[data-key]').forEach(input => {
    if (input.dataset.key === 'undatedLate') input.max = round(PIPELINE.undated - settings.undatedEarly);
    if (input !== except) {
      const value = settings[input.dataset.key];
      input.value = typeof value === 'number' ? round(value) : value;
    }
  });
  $('#controls').querySelectorAll('[data-rent-preset]').forEach(button => {
    const preset = rentPresets.find(item => item.id === button.dataset.rentPreset);
    button.setAttribute('aria-pressed', String(settings.rentHold === preset.hold && settings.rentChange === preset.change));
  });
}

function renderMetrics(scale, economics, gpu) {
  const cards = [
    ['Required first-year revenue', money(gpu.startingRevenue), `With flat rents: ${money(economics.hurdle)}/yr`],
    ['Capacity online by 2032', `${number(scale.capacity)} GW`, 'New U.S. capacity since 2025'],
    ['Investment through 2032', money(scale.investment), `${pct(scale.investmentRatio, 2)} of cumulative U.S. GDP`],
    ['Required starting GPU price', `$${number(gpu.startingPrice, 2)}`, `Per hour at ${pct(settings.utilization)} utilization`],
  ];
  $('#metrics').innerHTML = cards.map(([name, value, detail], index) => `<article class="metric ${index === 0 ? 'primary' : ''}">
    <p class="kicker">${name}</p><p class="value">${value}</p><p class="meta">${detail}</p></article>`).join('');
}

function heading(title, subtitle) {
  return `<div class="section-head"><div><h2>${title}</h2><p>${subtitle}</p></div></div>`;
}

function table(headers, rows, className = '') {
  return `<div class="data-table"><table class="${className}"><thead><tr>${headers.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label, ...cells]) => `<tr${label === 'Current scenario' ? ' class="current"' : ''}>
    <th scope="row">${label}</th>${cells.map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function segmentChart(entries, total) {
  const segments = entries.map(([, value, color]) => `<span style="width:${total ? value / total * 100 : 0}%;--swatch:${color}"></span>`).join('');
  return `<div class="segment-track" aria-hidden="true">${segments}</div><div class="segment-legend">${entries.map(
    ([name, , color, display]) => `<div><strong>${display}</strong><span><i class="swatch" style="--swatch:${color}" aria-hidden="true"></i>${name}</span></div>`,
  ).join('')}</div>`;
}

function renderRevenue(scale, economics) {
  const open = $('#sensitivity')?.open;
  const cases = [
    ['Current scenario', settings.margin, settings.itLife, economics.hurdle],
    ['NBER return assumptions', DEFAULTS.margin, DEFAULTS.itLife, revenue(DEFAULTS, scale).hurdle],
    ['Lower margin', 33, settings.itLife, revenue({ ...settings, margin: 33 }, scale).hurdle],
    ['Shorter GPU life', settings.margin, 3, revenue({ ...settings, itLife: 3 }, scale).hurdle],
    ['Both stresses', 33, 3, revenue({ ...settings, margin: 33, itLife: 3 }, scale).hurdle],
  ];
  const growth = economics.growth === null ? '—' : pct(economics.growth, 1);
  $('#results').innerHTML = `
    <article class="panel">
      ${heading('What does the buildout need to earn at flat rents?', 'Compare level annual revenue required from capacity online by 2032 with the demand scenario. Click the chart to change the margin.')}
      <div id="revenue-legend"></div>
      <canvas class="canvas interactive" id="revenue-chart" role="img" aria-label="Flat-rent annual revenue required by margin and GPU life. At the current margin the hurdle is ${money(economics.hurdle)}."></canvas>
      <div class="insight">
        <div><strong class="${tone(economics.gap)}">${signedMoney(economics.gap)}</strong><span>Surplus / shortfall vs. ${money(settings.demand * 1000, 1)} scenario</span></div>
        <div><strong>${money(economics.demandFromPrice)}</strong><span>Revenue at $${number(settings.price, 2)} per billed hour</span></div>
        <div><strong>${pct(economics.ratio, 1)}</strong><span>Required revenue / ${settings.denominator ? 'custom' : 'U.S.'} GDP</span></div>
      </div>
    </article>
    <article class="panel">
      ${heading('How sensitive is the hurdle?', 'The comparisons use your capacity and build costs.')}
      ${table(['Case', 'Cash-flow margin', 'GPU life', 'Flat-rent revenue / yr'], cases.map(
        ([name, margin, life, amount]) => [name, pct(margin), `${number(life, 0)} yr`, money(amount)],
      ))}
      <details id="sensitivity" ${open ? 'open' : ''}><summary>Model and market context</summary>
        <p class="note">A ${money(economics.capital)} commissioning capital base requires ${money(economics.cashFlow)} of annual operating cash flow. Divide that cash flow by the assumed margin to get the revenue hurdle. ${link(paper + '#page=27', 'Appendix D')}</p>
        <p class="note">The hurdle implies ${growth} annual revenue growth from the selected ${money(settings.marketBase * 1000)} starting point over 2026–2032. The revenue-to-GDP ratio compares sales with GDP. GDP measures value added. ${link(lustig, 'Hanno Lustig')}</p>
      </details>
    </article>`;
}

function renderGpu(economics, gpu) {
  const lastRent = pct(100 * gpu.profile.at(-1).rent, 1);
  const open = $('#rent-schedule')?.open;
  $('#results').innerHTML = `
    <article class="panel">
      ${heading('GPU rents over time', 'Rental rate as a share of starting rent. The dot marks the end of the selected GPU life.')}
      ${legend([['Your rental path', COLORS.green], ['6-year straight-line reference', COLORS.orange]])}
      <canvas class="canvas" id="gpu-chart" role="img" aria-label="Rental rate starts at 100% and is ${lastRent} in the last period. The schedule below lists each year."></canvas>
      <div class="insight">
        <div><strong>${lastRent}</strong><span>Final year’s rent as a share of starting rent</span></div>
        <div><strong>$${number(economics.priceHurdle, 2)}/hr</strong><span>Required billed rate with flat rents</span></div>
        <div><strong>${billions(economics.resale)}</strong><span>Net proceeds at GPU retirement</span></div>
      </div>
      <p class="note">The headline uses the rent path for IT and a level annual contribution for facilities. It scales the first year of a representative GPU vintage to the full buildout.</p>
      <details id="rent-schedule" ${open ? 'open' : ''}><summary>Annual rental schedule</summary>
        ${table(['Service year', 'Share of starting rent'], gpu.profile.map(
          period => [period.start + 1, pct(100 * period.rent, 1)],
        ))}
      </details>
    </article>
    <article class="panel">
      ${heading('What the a16z chart tells us', 'On October 19, 2026, A100 rents were 9% above the reference and H100 rents were 54% above it.')}
      <p class="note">a16z starts the reference at each chip’s first observed rent. Its newsletter also notes that both chips spent more time below the reference than above it. The snapshot supports testing a period of resilient rents. ${link(a16z, 'a16z post')} · ${link(a16zCharts, 'Chart context')}</p>
      <p class="note">Ornn measures executed on-demand rentals. Long-term contracts, utilization, and resale proceeds require separate assumptions. ${link(ornn, 'Ornn methodology')}</p>
    </article>`;
}

function renderBuildout(scale) {
  const capexRows = capexComparison(settings, scale);
  const excluded = scale.unadjustedInvestment - scale.investment;
  const outcomes = [
    ['Online by 2032', scale.capacity, COLORS.green, `${number(scale.capacity)} GW`],
    ['Online later', scale.delayed, COLORS.light, `${number(scale.delayed)} GW`],
    ['Canceled or downsized', scale.unrealized, COLORS.pale, `${number(scale.unrealized)} GW`],
  ];
  $('#results').innerHTML = `
    <article class="panel">
      ${heading('How much capacity gets built?', 'The paper assigns 516.7 GW of post-2024 U.S. capacity across three outcomes.')}
      ${segmentChart(outcomes, PIPELINE.total)}
      <p class="note">${number(Math.abs(scale.capacity - 150))} GW ${scale.capacity >= 150 ? 'above' : 'below'} the 150 GW episode threshold. ${link(paper + '#page=22', 'Table 4')}</p>
    </article>
    <article class="panel">
      ${heading('When does the money get spent?', 'Adjusted construction and equipment spending, including work in progress for campuses that open after 2032.')}
      <canvas class="canvas" id="spend-chart" role="img" aria-label="Modeled annual investment from 2025 to 2032 totals ${money(scale.investment)}. Yearly values are in the table below."></canvas>
      <div class="insight">
        <div><strong>${money(scale.unadjustedInvestment)}</strong><span>Modeled spend before adjustment</span></div>
        <div><strong>${money(excluded)}</strong><span>Excluded as other spending</span></div>
        <div><strong>${money(scale.investment)}</strong><span>Adjusted data center spend</span></div>
      </div>
      <details id="spend-table" ${$('#spend-table')?.open ? 'open' : ''}><summary>Annual investment and GDP</summary>
        ${table(['Year', 'New capacity', 'Before adjustment', 'Adjusted spend', 'Adjusted spend / GDP'], scale.annual.map(row =>
          [row.year, `${number(row.capacity)} GW`, billions(row.unadjustedInvestment), billions(row.investment), pct(row.investment / row.gdp * 100, 2)]))}
        <p class="note">The paper spreads undated capacity completed by 2032 evenly over 2028–2032. It prices each cohort at its completion-year cost and allocates 72.2% of that cost to the completion year. ${link(paper + '#page=23', 'Appendix B')}</p>
      </details>
    </article>
    <article class="panel">
      ${heading('Can observed capex explain the estimate?', 'Compare adjusted U.S. data center investment with the seven firms’ capex figures cited by Azeem Azhar.')}
      ${table(['Year', 'U.S. model', 'Adjusted U.S.', 'Big-seven AI', 'Big-seven other', 'Outside AI', 'Gap'], capexRows.map(row =>
        [row.year, billions(row.unadjusted), billions(row.scenario), billions(row.company),
          billions(row.otherCompanyCapex), billions(row.outside), (row.gap < 0 ? '−' : '') + billions(Math.abs(row.gap))]))}
      <p class="note">The comparison starts from $459B in 2025 and $879B in 2026 for seven firms across markets and business lines. The gap subtracts their estimated AI data center capex and any added outside AI capex from adjusted U.S. spend. Azhar’s comparison used the September draft. The modeled figures above use the October revision. Geography, reporting periods, and coverage differ. ${link(azhar, 'Azhar and Rocco exchange')}</p>
    </article>
    <article class="panel">
      ${heading('How large is this boom in historical terms?', 'Average of annual gross investment as a share of GDP over each buildout period.')}
      ${table(['Buildout', 'Period', 'Investment / GDP'], [
        ['Current scenario', '2025–2032', pct(scale.averageInvestmentRatio, 2)],
        ...COMPARISONS.map(item => [item.name, item.period, pct(item.ratio, 2)]),
      ])}
      <p class="note">The series differ in coverage and asset life. The AI spending model covers initial build and equipment costs. ${link(paper + '#page=25', 'Appendix C')}</p>
    </article>`;
}

function renderFinancing(scale) {
  const stress = financing(settings, scale);
  const loss = value => `$${number(value)}`;
  const entries = [
    ['Tenant', stress.tenant, COLORS.green, loss(stress.tenant)],
    ['Outside equity', stress.outsideEquity, COLORS.light, loss(stress.outsideEquity)],
    ['Project lenders', stress.lenders, COLORS.orange, loss(stress.lenders)],
  ];
  $('#results').innerHTML = `
    <article class="panel">
      ${heading('Who takes the project losses?', `Illustrative stress test per $100 of initial project value, with a ${pct(settings.valueHaircut)} value decline.`)}
      ${segmentChart(entries, settings.valueHaircut)}
      <div class="insight">
        <div><strong>${settings.valueHaircut ? pct(stress.tenant / settings.valueHaircut * 100, 1) : '—'}</strong><span>Share of loss borne by tenant</span></div>
        <div><strong>${loss(stress.institutions)}</strong><span>Loss at outside lenders and insurers</span></div>
        <div><strong>${loss(stress.shortMaturity)}</strong><span>Short-term debt exposed to rollover</span></div>
      </div>
      <p class="note">The collectible guarantee absorbs losses up to its cap. Project equity absorbs the remainder before lenders. Tenant losses include its share of project equity.</p>
    </article>
    <div class="summaries">
      <article class="panel">
        ${heading('Outside capital', `At a ${pct(settings.externalFunding)} outside share, investors supply ${money(stress.externalCapital)} of ${money(scale.investment)} in modeled investment through 2032.`)}
        <p class="note">The funding share is an assumption. Lease terms and guarantees determine how much risk the tenant retains.</p>
      </article>
      <article class="panel">
        ${heading('From losses to spillovers', 'Creditor losses and short-term refinancing needs are two possible channels.')}
        <p class="note">Krishnamurthy asked where risk ultimately sits and pointed to limited short-term debt in the conference draft. The project inputs are illustrative. ${link(discussion, 'Brookings discussion')}</p>
      </article>
    </div>
    <article class="panel">
      ${heading('What changes when leases count as debt?', 'The paper’s five firms had $388.7B in reported debt and $1.38T in obligations after including leases.')}
      ${table(['Firm', 'Debt / capital', 'Incl. leases', 'Debt / EBITDA', 'Incl. leases'], LEASE_LEVERAGE.map(
        ([name, debtCapital, leaseCapital, debtEbitda, leaseEbitda]) =>
          [name, pct(debtCapital), pct(leaseCapital), `${number(debtEbitda)}×`, `${number(leaseEbitda)}×`],
      ))}
      <p class="note">Table 8 includes recognized lease liabilities and values future lease commitments at 75% of their disclosed amount. The totals include some leases outside data centers. ${link(paper + '#page=31', 'Appendix E')}</p>
    </article>`;
}

const claims = [
  ['scale', 'More than 150 GW of new U.S. data center capacity comes online between 2025 and 2032.'],
  ['demand', 'By 2032, demand supports at least $3T a year in revenue from that new capacity.'],
  ['financing', 'Outside investors supply more than half of incremental AI infrastructure financing over the next few years.'],
  ['risk', 'If demand disappoints, hyperscalers bear most of the losses on projects they lease.'],
  ['spillovers', 'A substantial AI investment bust before 2032 causes material losses among lenders, insurers, or other infrastructure debt holders.'],
  ['history', 'The buildout resembles railroads or fiber in hindsight, with useful infrastructure built faster than investors can profitably absorb.'],
];

function beliefInput(id, person) {
  const key = `${id}-${person}`;
  const value = Number.isFinite(beliefs[key]) ? Math.max(0, Math.min(100, beliefs[key])) : '';
  return `<input type="number" min="0" max="100" step="1" data-belief="${key}" value="${value}" placeholder="—" aria-label="${person} probability for ${id} (%)">`;
}

function renderNotes() {
  $('#results').innerHTML = `<div class="notes-grid">
    <article class="panel">
      ${heading('Record your probabilities', 'Enter your estimate and optionally compare it with a partner’s. Entries are saved in this browser.')}
      ${table(['Claim', 'You (%)', 'Partner (%)'], claims.map(
        ([id, claim]) => [claim, beliefInput(id, 'You'), beliefInput(id, 'Partner')],
      ), 'claims')}
    </article>
    <article class="panel">
      ${heading('Questions to consider', 'Start with demand, then follow the losses.')}
      <ol>
        <li><strong>Who pays?</strong> Could competition push margins below 50%? How quickly do GPU rental prices decline as newer chips arrive? ${link(lustig, 'Lustig')}</li>
        <li><strong>Who takes the losses?</strong> How much downside stays with the hyperscaler through lease payments, equity, or residual-value guarantees? ${link(paper + '#page=9', 'Hyperion case')}</li>
        <li><strong>How do losses spread?</strong> Which creditors hold the exposure, and what would turn impairment into forced selling or a refinancing problem? ${link(discussion, 'Conference discussion')}</li>
        <li><strong>What gets built?</strong> Which projects clear power and regulatory hurdles? How much spending by project vehicles is missing from the early capex comparison? ${link(azhar, 'Capex debate')}</li>
      </ol>
    </article></div>`;
}

function drawCharts() {
  const scale = buildout(settings);
  const spendChart = $('#spend-chart');
  if (spendChart) plotSpend(spendChart, scale.annual);
  const gpuChart = $('#gpu-chart');
  if (gpuChart) plotGpuRent(gpuChart, gpuRentProfile(settings));
  const chart = $('#revenue-chart');
  if (!chart) return;
  const minimum = Math.min(20, Math.floor(settings.margin));
  const maximum = Math.max(80, Math.ceil(settings.margin));
  const margins = Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
  const lives = [...new Set([3, 6, settings.itLife])].sort((a, b) => a - b);
  const series = lives.map(life => {
    const active = life === settings.itLife;
    const color = active ? COLORS.green : life === 3 ? COLORS.orange : COLORS.gray;
    const cashFlow = revenue({ ...settings, itLife: life }, scale).cashFlow;
    return {
      active, color, label: `${number(life, Number.isInteger(life) ? 0 : 1)}-year GPU life`,
      values: margins.map(margin => cashFlow / (margin / 100)),
    };
  });
  $('#revenue-legend').innerHTML = legend([
    ...series.map(line => [line.label, line.color]), ['Revenue scenario', COLORS.blue],
  ]);
  chartMarginAt = plotRevenue(chart, series, settings.margin, revenue(settings, scale).hurdle, settings.demand * 1000, minimum, maximum);
}

function update() {
  const scale = buildout(settings);
  const economics = revenue(settings, scale);
  const gpu = gpuRevenue(settings, economics);
  const preset = PRESETS.find(({ settings: changes }) => Object.entries(settings)
    .every(([key, value]) => (changes[key] ?? DEFAULTS[key]) === value));
  $('#scenario-name').textContent = preset?.name ?? 'Custom scenario';
  $('#presets').querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.preset === preset?.id));
  });
  renderMetrics(scale, economics, gpu);
  if (view === 'revenue') renderRevenue(scale, economics);
  if (view === 'gpu') renderGpu(economics, gpu);
  if (view === 'buildout') renderBuildout(scale);
  if (view === 'financing') renderFinancing(scale);
  if (view === 'notes') renderNotes();
  drawCharts();
}

function storeSettings(values, except) {
  settings = normalize(values);
  saveStorage(storageKey, settings);
  const url = new URL(location.href);
  if (url.searchParams.has('scenario')) {
    url.searchParams.delete('scenario');
    history.replaceState(null, '', url);
  }
  syncControls(except);
  update();
}

$('#presets').innerHTML = PRESETS.map(({ id, name }) =>
  `<button type="button" class="preset" data-preset="${id}" aria-pressed="false">${name}</button>`).join('');

$('#presets').addEventListener('click', event => {
  const preset = PRESETS.find(item => item.id === event.target.dataset.preset);
  if (preset) storeSettings({ ...DEFAULTS, ...preset.settings });
});

$('#tabs').addEventListener('click', event => {
  const button = event.target.closest('button[data-view]');
  if (!button || button.dataset.view === view) return;
  view = button.dataset.view;
  renderControls();
  update();
});

$('#controls').addEventListener('input', event => {
  const { target } = event;
  const key = target.dataset.key;
  if (!key) return;
  const value = target.tagName === 'SELECT' ? target.value : target.valueAsNumber;
  if (typeof value === 'number' && !Number.isFinite(value)) return;
  if (target.type === 'number') {
    const [min, max] = LIMITS[key];
    if (value < min || value > max) return;
  }
  storeSettings({ ...settings, [key]: value }, target.type === 'number' ? target : null);
});

$('#controls').addEventListener('focusout', event => {
  if (event.target.type === 'number') {
    const { key } = event.target.dataset;
    const value = event.target.valueAsNumber;
    if (Number.isFinite(value) && value !== settings[key]) storeSettings({ ...settings, [key]: value });
    else syncControls();
  }
});

$('#controls').addEventListener('click', event => {
  if (event.target.id === 'reset') storeSettings(DEFAULTS);
  const preset = rentPresets.find(item => item.id === event.target.dataset.rentPreset);
  if (preset) storeSettings({ ...settings, rentHold: preset.hold, rentChange: preset.change });
});

$('#results').addEventListener('click', event => {
  if (event.target.id !== 'revenue-chart' || !chartMarginAt) return;
  const pixel = event.clientX - event.target.getBoundingClientRect().left;
  storeSettings({ ...settings, margin: chartMarginAt(pixel) });
});

$('#results').addEventListener('input', event => {
  const key = event.target.dataset.belief;
  if (!key) return;
  const value = event.target.valueAsNumber;
  if (Number.isFinite(value)) beliefs[key] = Math.max(0, Math.min(100, Math.round(value)));
  else delete beliefs[key];
  saveStorage(beliefsKey, beliefs);
});

$('#results').addEventListener('focusout', event => {
  const key = event.target.dataset.belief;
  if (key) event.target.value = beliefs[key] ?? '';
});

function notify(message) {
  clearTimeout(notifyTimer);
  const notification = $('#notification');
  notification.textContent = message;
  notification.hidden = false;
  notifyTimer = setTimeout(() => { notification.hidden = true; }, 2600);
}

$('#share').addEventListener('click', async () => {
  const url = new URL(location.href);
  url.hash = Object.keys(viewsByHash).find(hash => viewsByHash[hash] === view) ?? '';
  const changes = Object.fromEntries(Object.entries(settings).filter(([key, value]) => value !== DEFAULTS[key]));
  url.searchParams.set('scenario', JSON.stringify(changes));
  try {
    await navigator.clipboard.writeText(url.href);
    notify('Scenario link copied');
  } catch {
    window.prompt('Copy this scenario link', url.href);
  }
});

let resizeFrame;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(drawCharts);
});

renderControls();
update();
document.fonts.ready.then(drawCharts);
