(function () {
  'use strict';

  const root = document.getElementById('gdp-model');
  if (!root) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BASE_GDP = 100;
  const CAPITAL_SHARE = 0.6;
  const SEED_SHARE = 0.5;
  const CAPITAL_LABOR_SHARE = 1 - SEED_SHARE;
  const FACTORY_REPLICATION = 2;

  const controls = {
    patience: document.getElementById('model-patience'),
    wealth: document.getElementById('model-wealth'),
    capitalProductivity: document.getElementById('model-capital-productivity'),
    normalProductivity: document.getElementById('model-normal-productivity'),
    spaceProductivity: document.getElementById('model-space-productivity'),
    tourism: document.getElementById('model-tourism'),
    richSpace: document.getElementById('model-rich-space'),
    factoryShare: document.getElementById('model-factory-share'),
    richSatiation: document.getElementById('model-rich-satiation')
  };

  const outputs = {
    patience: document.getElementById('model-patience-value'),
    savingImplied: document.getElementById('model-saving-implied'),
    wealth: document.getElementById('model-wealth-value'),
    capitalProductivity: document.getElementById('model-capital-productivity-value'),
    interestImplied: document.getElementById('model-interest-implied'),
    normalProductivity: document.getElementById('model-normal-productivity-value'),
    spaceProductivity: document.getElementById('model-space-productivity-value'),
    tourism: document.getElementById('model-tourism-value'),
    richSpace: document.getElementById('model-rich-space-value'),
    richSpaceEffective: document.getElementById('model-rich-space-effective'),
    factoryShare: document.getElementById('model-factory-share-value'),
    factoryLegacy: document.getElementById('model-factory-legacy'),
    richSatiation: document.getElementById('model-rich-satiation-value'),
    capitalSeed: document.getElementById('model-capital-seed'),
    capitalLabor: document.getElementById('model-capital-labor'),
    capitalSectorProductivity: document.getElementById('model-capital-sector-productivity'),
    capitalOutput: document.getElementById('model-capital-output'),
    nominalGrowth: document.getElementById('model-nominal-growth'),
    chainGrowth: document.getElementById('model-chain-growth'),
    consumptionGrowth: document.getElementById('model-consumption-growth'),
    spacePrice: document.getElementById('model-space-price'),
    factoryPrice: document.getElementById('model-factory-price'),
    chartNote: document.getElementById('model-chart-note')
  };

  const chart = document.getElementById('model-chart');

  function number(value) {
    return Number(value);
  }

  function formatNumber(value, digits) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: digits === undefined ? 0 : digits
    }).format(value);
  }

  function formatPercent(value) {
    const rounded = Math.round(value);
    if (Math.abs(rounded) >= 1000000) {
      const compact = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(Math.abs(rounded));
      return (rounded >= 0 ? '+' : '-') + compact + '%';
    }
    return (rounded >= 0 ? '+' : '') + formatNumber(rounded) + '%';
  }

  function formatChartNumber(value) {
    if (Math.abs(value) >= 1000000) {
      return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(value);
    }
    return formatNumber(value, value < 20 ? 1 : 0);
  }

  function formatMultiplier(value) {
    if (value >= 1000) return formatNumber(value, 0) + '\u00d7';
    if (value >= 10) return formatNumber(value, 1) + '\u00d7';
    return value.toFixed(2).replace(/0$/, '') + '\u00d7';
  }

  function calculate() {
    const beta = number(controls.patience.value);
    const seedToGdpRatio = number(controls.wealth.value);
    const capitalProductivity = Math.pow(10, number(controls.capitalProductivity.value));
    const ordinaryGrowth = number(controls.normalProductivity.value) / 100;
    const spaceProductivity = Math.pow(10, number(controls.spaceProductivity.value));
    const tourismShare = number(controls.tourism.value) / 100;
    const richSpaceShare = number(controls.richSpace.value) / 100;
    const factoryShare = number(controls.factoryShare.value) / 100;
    const richSatiationIndexUnits = number(controls.richSatiation.value);
    const ordinaryProductivity2 = 1 + ordinaryGrowth;

    const savingRate = beta / (
      1 + (1 - beta) * (1 - CAPITAL_SHARE) /
      CAPITAL_SHARE
    );
    const householdSaving = savingRate * BASE_GDP;
    const investment1 = householdSaving / (1 - SEED_SHARE);
    const normalSpending1 = BASE_GDP - householdSaving;
    const nominalGdp1 = normalSpending1 + investment1;
    const richCapital = seedToGdpRatio * nominalGdp1;
    const spaceNominal1 = tourismShare * normalSpending1;
    const ordinaryNominal1 = normalSpending1 - spaceNominal1;

    const capitalLabor = CAPITAL_LABOR_SHARE * investment1;
    const productiveCapital2 = BASE_GDP * capitalProductivity *
      Math.pow(richCapital / BASE_GDP, SEED_SHARE) *
      Math.pow(capitalLabor / (CAPITAL_LABOR_SHARE * BASE_GDP), CAPITAL_LABOR_SHARE);
    const capitalPrice = investment1 / productiveCapital2;
    const householdCapital2 = (1 - SEED_SHARE) * productiveCapital2;
    const entrepreneurCapital2 = SEED_SHARE * productiveCapital2;
    const householdSectorGdp2 = ordinaryProductivity2 *
      Math.pow(householdCapital2, CAPITAL_SHARE) *
      Math.pow(BASE_GDP, 1 - CAPITAL_SHARE);
    const richIncome2 = ordinaryProductivity2 * entrepreneurCapital2;
    const nominalGdp2 = householdSectorGdp2 + richIncome2;
    const wage2 = (1 - CAPITAL_SHARE) * householdSectorGdp2 / BASE_GDP;
    const capitalRentalRate2 = CAPITAL_SHARE * householdSectorGdp2 / householdCapital2;
    const equilibriumInterest = capitalRentalRate2 / capitalPrice;
    const normalIncome2 = householdSectorGdp2;

    const richSatiation = richSatiationIndexUnits * nominalGdp1 / BASE_GDP;
    const richOrdinaryUnconstrained = (1 - richSpaceShare) * richIncome2;
    const householdSpaceNominal2 = tourismShare * normalIncome2;
    const richOrdinary2 = Math.min(
      richOrdinaryUnconstrained,
      richSatiation,
      householdSpaceNominal2
    );
    const richNonFoodSpending2 = richIncome2 - richOrdinary2;
    const richFactoryNominal2 = factoryShare * richNonFoodSpending2;
    const richSpaceNominal2 = (1 - factoryShare) * richNonFoodSpending2;
    const householdOrdinary2 = (1 - tourismShare) * normalIncome2;
    const spaceNominal2 = householdSpaceNominal2 + richSpaceNominal2;
    const ordinaryNominal2 = householdOrdinary2 + richOrdinary2;
    const spacePrice2 = ordinaryProductivity2 / spaceProductivity;
    const factoryPrice2 = ordinaryProductivity2 / FACTORY_REPLICATION;
    const spaceQuantity2 = spaceNominal2 / spacePrice2;
    const factoryQuantity2 = richFactoryNominal2 / factoryPrice2;
    const automatedShips2 = (richIncome2 - richFactoryNominal2) / spacePrice2;
    const conventionalShips2 = Math.max(0, spaceQuantity2 - automatedShips2);
    const realFactoryInvestment2 = capitalPrice * factoryQuantity2;
    const realGdp2 = ordinaryNominal2 + spaceQuantity2 + realFactoryInvestment2;
    const period1AtPeriod2Prices = ordinaryNominal1 +
      spacePrice2 * spaceNominal1 + factoryPrice2 * productiveCapital2;
    const laspeyresQuantity = realGdp2 / nominalGdp1;
    const paascheQuantity = nominalGdp2 / period1AtPeriod2Prices;
    const fisherQuantity = Math.sqrt(laspeyresQuantity * paascheQuantity);

    const normalConsumption1 = ordinaryNominal1 / BASE_GDP;
    const normalConsumption2 = ((1 - tourismShare) * normalIncome2) / BASE_GDP;
    const indexScale = BASE_GDP / nominalGdp1;

    return {
      params: {
        beta,
        savingRate,
        householdSaving,
        investment1,
        nominalGdp1,
        seedToGdpRatio,
        richCapital,
        capitalLabor,
        capitalProductivity,
        ordinaryGrowth,
        spaceProductivity,
        tourismShare,
        richSpaceShare,
        factoryShare,
        richSatiation: richSatiationIndexUnits,
        normalIncome2,
        richIncome2,
        richOrdinary2,
        richSpaceNominal2,
        richFactoryNominal2,
        factoryQuantity2,
        automatedShips2,
        conventionalShips2,
        equilibriumInterest,
        capitalPrice,
        householdCapital2,
        entrepreneurCapital2,
        capitalPerWorker: productiveCapital2 / BASE_GDP,
        nominalGdp2
      },
      period1: {
        ordinary: ordinaryNominal1 * indexScale,
        space: spaceNominal1 * indexScale,
        investment: investment1 * indexScale,
        total: BASE_GDP
      },
      period2Nominal: {
        ordinary: ordinaryNominal2 * indexScale,
        space: spaceNominal2 * indexScale,
        investment: richFactoryNominal2 * indexScale,
        total: nominalGdp2 * indexScale
      },
      period2Real: {
        ordinary: ordinaryNominal2 * indexScale,
        space: spaceQuantity2 * indexScale,
        investment: realFactoryInvestment2 * indexScale,
        total: realGdp2 * indexScale
      },
      spacePrice2,
      factoryPrice2,
      nominalGrowth: (nominalGdp2 / nominalGdp1 - 1) * 100,
      realGrowth: (realGdp2 / nominalGdp1 - 1) * 100,
      chainGrowth: (fisherQuantity - 1) * 100,
      consumptionGrowth: normalConsumption1 > 0
        ? (normalConsumption2 / normalConsumption1 - 1) * 100
        : 0
    };
  }

  function svgElement(name, attributes, textContent) {
    const element = document.createElementNS(SVG_NS, name);
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });
    if (textContent !== undefined) element.textContent = textContent;
    return element;
  }

  function niceMaximum(value) {
    if (value <= 0) return 100;
    const power = Math.pow(10, Math.floor(Math.log10(value)));
    const step = power / 2;
    return Math.ceil(value / step) * step;
  }

  function drawChart(model) {
    while (chart.firstChild) chart.removeChild(chart.firstChild);

    chart.appendChild(svgElement('title', { id: 'model-chart-svg-title' }, 'GDP in periods 1 and 2'));
    chart.appendChild(svgElement(
      'desc',
      { id: 'model-chart-svg-desc' },
      'Period 1 GDP is ' + formatNumber(model.period1.total, 1) +
      '. Period 2 nominal GDP is ' + formatNumber(model.period2Nominal.total, 1) +
      ', and period 2 real GDP is ' + formatNumber(model.period2Real.total, 1) + '.'
    ));

    const width = 720;
    const height = 390;
    const margin = { top: 48, right: 24, bottom: 72, left: 72 };
    const plotHeight = height - margin.top - margin.bottom;
    const plotBottom = margin.top + plotHeight;
    const data = [
      { label: 'Period 1', sublabel: 'current prices', values: model.period1 },
      { label: 'Period 2', sublabel: 'current prices', values: model.period2Nominal },
      { label: 'Period 2', sublabel: 'period-1 prices', values: model.period2Real }
    ];
    const maxValue = niceMaximum(Math.max.apply(null, data.map(function (d) { return d.values.total; })) * 1.08);
    const xPositions = [132, 338, 544];
    const barWidth = 112;

    for (let i = 0; i <= 4; i += 1) {
      const tickValue = maxValue * i / 4;
      const y = plotBottom - (tickValue / maxValue) * plotHeight;
      chart.appendChild(svgElement('line', {
        class: 'model-chart__grid',
        x1: margin.left,
        x2: width - margin.right,
        y1: y,
        y2: y
      }));
      chart.appendChild(svgElement('text', {
        class: 'model-chart__tick',
        x: margin.left - 12,
        y: y + 4,
        'text-anchor': 'end'
      }, formatChartNumber(tickValue)));
    }

    data.forEach(function (datum, index) {
      let cumulative = 0;
      const segments = [
        { key: 'ordinary', className: 'model-chart__ordinary' },
        { key: 'space', className: 'model-chart__space' },
        { key: 'investment', className: 'model-chart__investment' }
      ];

      segments.forEach(function (segment) {
        const value = datum.values[segment.key];
        if (value <= 0) return;
        const segmentHeight = Math.max(0, (value / maxValue) * plotHeight);
        const y = plotBottom - ((cumulative + value) / maxValue) * plotHeight;
        chart.appendChild(svgElement('rect', {
          class: segment.className,
          x: xPositions[index],
          y: y,
          width: barWidth,
          height: segmentHeight
        }));

        if (segmentHeight >= 28) {
          chart.appendChild(svgElement('text', {
            class: 'model-chart__segment-label',
            x: xPositions[index] + barWidth / 2,
            y: y + segmentHeight / 2 + 4,
            'text-anchor': 'middle'
          }, Math.round(value / datum.values.total * 100) + '%'));
        }
        cumulative += value;
      });

      const totalY = plotBottom - (datum.values.total / maxValue) * plotHeight;
      chart.appendChild(svgElement('text', {
        class: 'model-chart__total',
        x: xPositions[index] + barWidth / 2,
        y: Math.max(22, totalY - 12),
        'text-anchor': 'middle'
      }, formatChartNumber(datum.values.total)));
      chart.appendChild(svgElement('text', {
        class: 'model-chart__label',
        x: xPositions[index] + barWidth / 2,
        y: plotBottom + 28,
        'text-anchor': 'middle'
      }, datum.label));
      chart.appendChild(svgElement('text', {
        class: 'model-chart__sublabel',
        x: xPositions[index] + barWidth / 2,
        y: plotBottom + 49,
        'text-anchor': 'middle'
      }, datum.sublabel));
    });
  }

  function update() {
    const model = calculate();
    const p = model.params;

    outputs.patience.textContent = p.beta.toFixed(2);
    outputs.savingImplied.textContent = 'Implied saving rate: ' +
      formatNumber(p.savingRate * 100, 1) + '%';
    outputs.wealth.textContent = p.seedToGdpRatio.toFixed(2) + '\u00d7 GDP';
    outputs.capitalProductivity.textContent = formatMultiplier(p.capitalProductivity);
    outputs.interestImplied.textContent = 'Equilibrium gross return: ' +
      formatMultiplier(p.equilibriumInterest);
    outputs.capitalSeed.textContent = formatNumber(p.richCapital, 1);
    outputs.capitalLabor.textContent = formatNumber(p.capitalLabor, 1);
    outputs.capitalSectorProductivity.textContent = 'Z = ' +
      formatMultiplier(p.capitalProductivity);
    outputs.capitalOutput.textContent = formatNumber(p.capitalPerWorker * BASE_GDP, 1);
    outputs.normalProductivity.textContent = Math.round(p.ordinaryGrowth * 100) + '%';
    outputs.spaceProductivity.textContent = formatMultiplier(p.spaceProductivity);
    outputs.tourism.textContent = formatNumber(p.tourismShare * 100, 1) + '%';
    outputs.richSpace.textContent = Math.round(p.richSpaceShare * 100) + '%';
    outputs.factoryShare.textContent = Math.round(p.factoryShare * 100) + '%';
    outputs.richSatiation.textContent = formatNumber(p.richSatiation, 2) + ' units';

    const richEffectiveSpaceShare = p.richIncome2 > 0
      ? p.richSpaceNominal2 / p.richIncome2 * 100
      : 0;
    outputs.richSpaceEffective.textContent = 'Direct space after factories: ' +
      formatNumber(richEffectiveSpaceShare, 1) + '%';
    outputs.factoryLegacy.textContent = 'Labor-free output: ' +
      formatNumber(p.factoryQuantity2, 1) + ' factories + ' +
      formatNumber(p.automatedShips2, 1) + ' ships';

    outputs.nominalGrowth.textContent = formatPercent(model.nominalGrowth);
    outputs.chainGrowth.textContent = formatPercent(model.chainGrowth);
    outputs.consumptionGrowth.textContent = formatPercent(model.consumptionGrowth);
    outputs.spacePrice.textContent = formatNumber(model.spacePrice2, model.spacePrice2 < 0.1 ? 3 : 2);
    outputs.factoryPrice.textContent = formatNumber(model.factoryPrice2, model.factoryPrice2 < 0.1 ? 3 : 2);
    const spaceShare = model.period2Nominal.space / model.period2Nominal.total * 100;
    const factoryGdpShare = model.period2Nominal.investment /
      model.period2Nominal.total * 100;
    outputs.chartNote.textContent =
      'Factory investment is ' + formatNumber(factoryGdpShare, 1) +
      '% of period-2 GDP; direct spacecraft are ' + formatNumber(spaceShare, 1) +
      '%. The entrepreneur\'s factory stock produces ' +
      formatNumber(p.factoryQuantity2, 1) + ' successor factories and ' +
      formatNumber(p.automatedShips2, 1) +
      ' spacecraft during period 2, without labor.';

    drawChart(model);
  }

  Object.keys(controls).forEach(function (key) {
    controls[key].addEventListener('input', update);
  });

  update();
}());
