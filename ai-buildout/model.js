export const YEARS = Array.from({ length: 8 }, (_, index) => 2025 + index);
export const PIPELINE = { undated: 313.9, datedDelayed: 19.9, datedLater: 5.2, total: 516.7 };
const PUBLISHED_GDP = [30762, 31992, 33272, 34603, 35987, 37427, 38924, 40481];
export const CORPORATE_CAPEX = [459, 879];
export const COMPARISONS = [
  { name: 'Canals', ratio: 0.66, period: '1836–1841' },
  { name: 'Railroads', ratio: 2.24, period: '1870–1890' },
  { name: 'Electrification', ratio: 0.50, period: '1905–1925' },
  { name: 'Highways', ratio: 1.13, period: '1956–1973' },
  { name: 'Telecom and fiber', ratio: 1.10, period: '1996–2003' },
];

// October 11 revision, Tables 5–6 and Appendix B.
const TABLE_6_COST = [563.9, 1133.6, 1588.8, 2005.5, 1029.6, 881.9, 835.5, 723.4];
const EXPENDITURE_WEIGHTS = [0.72195, 0.17561, 0.05122, 0.05122];
// Approximate dated 2033–35 capacity implied by the rounded annual investment
// totals. Dated capacity after 2035 has no spending in the 2025–32 window.
const DATED_LATER_IN_WINDOW = [0.86, 0.55, 2.12];
const BASELINE_CAPACITY = 188.3;
const BASELINE_GPU_COUNT = 79.3e6;
const FIRST_UNDATED_INDEX = 3; // 2028

// Table 8. Reported and lease-adjusted obligations as shares of book capital
// and as multiples of EBITDA, in that order.
export const LEASE_LEVERAGE = [
  ['Alphabet', 14, 23, 0.6, 1.1],
  ['Meta', 24, 59, 0.8, 3.4],
  ['Microsoft', 8, 46, 0.2, 1.9],
  ['Oracle', 75, 90, 4.3, 12.1],
  ['CoreWeave', 87, 94, 9.3, 20.8],
  ['All five', 22, 50, 0.8, 2.7],
];

export const DEFAULTS = Object.freeze({
  margin: 50, itLife: 6, returnRate: 10, utilization: 80,
  rentHold: 1, rentChange: 0, gpuResale: 0,
  itShare: 68, otherLife: 20, demand: 3, price: 5,
  marketBase: 0.1, denominator: 0,
  undatedEarly: 54, undatedLate: 89.8, unitCost: 41,
  costGrowth: 4, gdpGrowth: 4, spendExclusion: 0,
  companyAiShare: 64, outside2025: 0, outside2026: 0,
  externalFunding: 55, valueHaircut: 35, leverage: 85, tenantEquity: 20,
  guaranteeShare: 50, guaranteeCap: 15, collectability: 100,
  lenderExposure: 60, shortDebt: 10,
});

export const LIMITS = {
  margin: [5, 100], itLife: [1, 20], returnRate: [0, 35], utilization: [5, 100],
  rentHold: [1, 20], rentChange: [-50, 10], gpuResale: [0, 100],
  itShare: [0, 100], otherLife: [1, 60], demand: [0, 40], price: [0, 40],
  marketBase: [0, 20], denominator: [0, 400],
  undatedEarly: [0, PIPELINE.undated], undatedLate: [0, PIPELINE.undated],
  unitCost: [1, 150], costGrowth: [-15, 30], gdpGrowth: [-15, 20], spendExclusion: [0, 100],
  companyAiShare: [0, 100], outside2025: [0, 3000], outside2026: [0, 3000],
  externalFunding: [0, 100], valueHaircut: [0, 100], leverage: [0, 100],
  tenantEquity: [0, 100], guaranteeShare: [0, 100], guaranteeCap: [0, 100],
  collectability: [0, 100], lenderExposure: [0, 100], shortDebt: [0, 100],
};

const sum = values => values.reduce((total, value) => total + value, 0);
const fraction = value => value / 100;

export function normalize(input = {}) {
  const values = { ...DEFAULTS };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const value = input?.[key];
    if (Number.isFinite(value)) values[key] = Math.max(min, Math.min(max, value));
  }
  values.undatedLate = Math.min(values.undatedLate, PIPELINE.undated - values.undatedEarly);
  values.rentHold = Math.round(values.rentHold);
  return values;
}

export function capitalRecovery(rate, life) {
  return rate === 0 ? 1 / life : rate / -Math.expm1(-life * Math.log1p(rate));
}

export function gpuRentProfile(a) {
  const change = fraction(a.rentChange);
  return Array.from({ length: Math.ceil(a.itLife) }, (_, year) => ({
    start: year,
    end: Math.min(year + 1, a.itLife),
    rent: (1 + change) ** Math.max(0, year + 1 - a.rentHold),
  }));
}

function annuityValue(rate, life) {
  return life === 0 ? 0 : 1 / capitalRecovery(rate, life);
}

function costPerMw(a, index) {
  return a.unitCost * (1 + fraction(a.costGrowth)) ** index;
}

const BASELINE_GW = TABLE_6_COST.map((cost, index) => cost / costPerMw(DEFAULTS, index));

export function buildout(a) {
  const dataCenterShare = 1 - fraction(a.spendExclusion ?? 0);
  const undatedChange = (a.undatedEarly - DEFAULTS.undatedEarly) / (YEARS.length - FIRST_UNDATED_INDEX);
  const through2032 = BASELINE_GW.map((gw, index) => index < FIRST_UNDATED_INDEX ? gw : gw + undatedChange);
  const delayedPerYear = (PIPELINE.datedDelayed + a.undatedLate) / 5;
  const after2032 = DATED_LATER_IN_WINDOW.map(gw => gw + delayedPerYear);
  const costs = [...through2032, ...after2032].map((gw, index) => gw * costPerMw(a, index));
  const annual = YEARS.map((year, index) => {
    const unadjustedInvestment = sum(EXPENDITURE_WEIGHTS.map((weight, offset) => weight * costs[index + offset]));
    const investment = unadjustedInvestment * dataCenterShare;
    const gdp = PUBLISHED_GDP[index] * ((1 + fraction(a.gdpGrowth)) / 1.04) ** index;
    return { year, investment, unadjustedInvestment, gdp, capacity: through2032[index] };
  });
  const investment = sum(annual.map(row => row.investment));
  const unadjustedInvestment = sum(annual.map(row => row.unadjustedInvestment));
  const cumulativeGdp = sum(annual.map(row => row.gdp));
  // Anchor aggregate capacity to Table 4. Individual cohorts use Table 6's
  // rounded costs and may differ slightly when summed.
  const capacity = BASELINE_CAPACITY + a.undatedEarly - DEFAULTS.undatedEarly;
  const delayed = PIPELINE.datedDelayed + PIPELINE.datedLater + a.undatedLate;
  const averageInvestmentRatio = 100 * sum(annual.map(row => row.investment / row.gdp)) / YEARS.length;
  return {
    annual, investment, unadjustedInvestment, cumulativeGdp, investmentRatio: 100 * investment / cumulativeGdp,
    averageInvestmentRatio, capacity, delayed, unrealized: PIPELINE.total - capacity - delayed,
    commissioningCost: sum(costs.slice(0, YEARS.length)) * dataCenterShare,
  };
}

export function revenue(a, scale) {
  const rate = fraction(a.returnRate);
  const carry = sum(EXPENDITURE_WEIGHTS.map((weight, years) => weight * (1 + rate) ** years));
  const capital = scale.commissioningCost * carry;
  const itShare = fraction(a.itShare);
  const itCapital = capital * itShare;
  const otherCharge = (capital - itCapital) * capitalRecovery(rate, a.otherLife);
  const resale = scale.commissioningCost * itShare * fraction(a.gpuResale);
  const netItCapital = itCapital - resale / (1 + rate) ** a.itLife;
  const cashFlow = otherCharge + netItCapital * capitalRecovery(rate, a.itLife);
  const margin = fraction(a.margin);
  const hurdle = cashFlow / margin;
  const gpus = scale.capacity / BASELINE_CAPACITY * BASELINE_GPU_COUNT;
  const billedHours = gpus * 8760 * fraction(a.utilization);
  const demandFromPrice = a.price * billedHours / 1e9;
  const denominator = a.denominator > 0 ? a.denominator * 1000 : scale.annual.at(-1).gdp;
  return {
    capital, cashFlow, hurdle, capitalCharge: capital > 0 ? cashFlow / capital : 0, gpus, demandFromPrice,
    netItCapital, otherCharge, resale, billedHours,
    priceHurdle: hurdle * 1e9 / billedHours,
    gap: a.demand * 1000 - hurdle,
    ratio: 100 * hurdle / denominator,
    growth: a.marketBase > 0 ? 100 * ((hurdle / (a.marketBase * 1000)) ** (1 / 6) - 1) : null,
  };
}

export function gpuRevenue(a, economics) {
  const profile = gpuRentProfile(a);
  const rate = fraction(a.returnRate);
  const rentPresentValue = sum(profile.map(({ start, end, rent }) =>
    rent * (annuityValue(rate, end) - annuityValue(rate, start))));
  const startingRevenue = (economics.otherCharge + economics.netItCapital / rentPresentValue) / fraction(a.margin);
  return {
    profile, startingRevenue,
    startingPrice: startingRevenue * 1e9 / economics.billedHours,
  };
}

export function financing(a, scale) {
  // Losses are dollars per $100 of original project value.
  const loss = a.valueHaircut;
  const tenantSupport = Math.min(loss * fraction(a.guaranteeShare), a.guaranteeCap)
    * fraction(a.collectability);
  const equity = 100 - a.leverage;
  const equityLoss = Math.min(equity, loss - tenantSupport);
  const lenderLoss = Math.max(0, loss - tenantSupport - equityLoss);
  const tenantEquityLoss = equityLoss * fraction(a.tenantEquity);
  return {
    externalCapital: scale.investment * fraction(a.externalFunding),
    tenant: tenantSupport + tenantEquityLoss,
    outsideEquity: equityLoss - tenantEquityLoss,
    lenders: lenderLoss,
    institutions: lenderLoss * fraction(a.lenderExposure),
    shortMaturity: a.leverage * fraction(a.shortDebt),
  };
}

export function capexComparison(a, scale) {
  return CORPORATE_CAPEX.map((capex, index) => {
    const company = capex * fraction(a.companyAiShare);
    const outside = index === 0 ? a.outside2025 : a.outside2026;
    const { year, investment, unadjustedInvestment } = scale.annual[index];
    return {
      year, scenario: investment, unadjusted: unadjustedInvestment,
      company, otherCompanyCapex: capex - company, outside,
      gap: investment - company - outside,
    };
  });
}

export const PRESETS = [
  { id: 'baseline', name: 'NBER baseline', settings: {} },
  { id: 'margin', name: '33% margin', settings: { margin: 33 } },
  { id: 'life', name: '3-year GPUs', settings: { itLife: 3 } },
  { id: 'delay', name: 'More delays', settings: { undatedEarly: 15, undatedLate: 128.8 } },
];
