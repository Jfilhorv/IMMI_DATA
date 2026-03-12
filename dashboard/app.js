(function () {
  'use strict';

  var base = (function () {
    var href = window.location.href;
    var last = href.lastIndexOf('/');
    return last >= 0 ? href.slice(0, last + 1) : '';
  })();
  var CACHE_BUST = '?v=2';
  var TABLES_URL = base + 'data/tables.json' + CACHE_BUST;
  var DATA_URL = base + 'data/indicators.csv' + CACHE_BUST;
  var CATEGORY_TABLES_URL = base + 'data/category_tables.json' + CACHE_BUST;
  var categoryTables = [];
  var SECTION_LABELS = {
    1: '1. Permanent migration',
    2: '2. Temporary visas',
    3: '3. Humanitarian Program',
    4: '4. Visa cancellations & departures',
    5: '5. Net Overseas Migration',
    6: '6. Citizenship',
    7: '7. Labour market'
  };
  var tableList = [];
  var allData = [];
  var tablesWithData = new Set();
  var chart = null;
  var chartType = 'bar';
  var KPI_TABLE = '1_0';
  var KPI_INDICATORS = ['Skill stream', 'Family stream1', 'Child stream2', 'Special Eligibility', 'Total3'];
  var MAP_TABLE_TEST = '1_3';
  var GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
  var countryToIso = {
    'India': 'IN', 'United Kingdom': 'GB', 'Philippines': 'PH', 'South Africa': 'ZA', 'Sri Lanka': 'LK',
    "People's Republic of China1": 'CN', "People's Republic of China2": 'CN', 'Nepal': 'NP', 'Ireland': 'IE',
    'Brazil': 'BR', 'Pakistan': 'PK', 'Republic of Korea': 'KR', 'Italy': 'IT', 'Zimbabwe': 'ZW',
    'Colombia': 'CO', 'Vietnam': 'VN', 'United States of America': 'US', 'New Zealand': 'NZ', 'Iraq': 'IQ',
    'Afghanistan': 'AF', 'Iran': 'IR', 'Syria': 'SY', 'Sudan': 'SD', 'Egypt': 'EG', 'Malaysia': 'MY',
    'Indonesia': 'ID', 'Thailand': 'TH', 'Bangladesh': 'BD', 'Singapore': 'SG', 'Hong Kong': 'HK'
  };
  var leafletMap = null;
  var mapGeoLayer = null;

  function parseCSVLine(line) {
    const out = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        i++;
        let s = '';
        while (i < line.length && line[i] !== '"') {
          s += line[i];
          i++;
        }
        if (line[i] === '"') i++;
        out.push(s.trim());
      } else {
        let s = '';
        while (i < line.length && line[i] !== ',') {
          s += line[i];
          i++;
        }
        out.push(s.trim());
        if (line[i] === ',') i++;
      }
    }
    return out;
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = parseCSVLine(lines[0]);
    const hasCategory = header.indexOf('category') >= 0;
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length >= 4) {
        const row = {
          indicator: values[0],
          year: parseInt(values[1], 10),
          value: parseFloat(values[2]),
          table: values[3] || ''
        };
        if (hasCategory && values.length >= 5) row.category = values[4] || '';
        rows.push(row);
      }
    }
    return rows;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function getKpiData() {
    var out = [];
    KPI_INDICATORS.forEach(function (ind) {
      var rows = allData.filter(function (r) { return r.table === KPI_TABLE && r.indicator === ind; });
      rows.sort(function (a, b) { return a.year - b.year; });
      var last3 = rows.slice(-3);
      var latest = last3[last3.length - 1];
      var prev = last3.length >= 2 ? last3[last3.length - 2] : null;
      var pct = prev && prev.value && latest ? ((latest.value - prev.value) / prev.value * 100) : null;
      out.push({ indicator: ind, years: last3.map(function (r) { return r.year; }), values: last3.map(function (r) { return r.value; }), latest: latest ? latest.value : null, pct: pct });
    });
    return out;
  }

  function drawSparkline(canvasId, values) {
    var el = document.getElementById(canvasId);
    if (!el || !values || values.length === 0) return;
    var dpr = window.devicePixelRatio || 1;
    var w = el.parentElement.clientWidth || 120;
    var h = 32;
    el.width = w * dpr;
    el.height = h * dpr;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    var ctx = el.getContext('2d');
    ctx.scale(dpr, dpr);
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var range = max - min || 1;
    var pad = 4;
    var x0 = pad;
    var x1 = w - pad;
    var y0 = h - pad;
    var step = values.length > 1 ? (x1 - x0) / (values.length - 1) : 0;
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach(function (v, i) {
      var x = x0 + i * step;
      var y = y0 - ((v - min) / range) * (h - 2 * pad);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function updateKpiCards() {
    var data = getKpiData();
    data.forEach(function (d, i) {
      var valEl = document.getElementById('kpi-' + i + '-val');
      var changeEl = document.getElementById('kpi-' + i + '-change');
      if (valEl) valEl.textContent = d.latest != null ? d.latest.toLocaleString('en-AU', { maximumFractionDigits: 0 }) : '—';
      if (changeEl) {
        changeEl.textContent = '';
        changeEl.className = 'kpi-change neutral';
        if (d.pct != null && isFinite(d.pct)) {
          changeEl.textContent = (d.pct >= 0 ? '+' : '') + d.pct.toFixed(1) + '%';
          changeEl.className = 'kpi-change ' + (d.pct > 0 ? 'positive' : d.pct < 0 ? 'negative' : 'neutral');
        }
      }
      drawSparkline('kpi-' + i + '-spark', d.values);
    });
  }

  function getIndicatorsForTable(tableId) {
    const set = new Set();
    allData.forEach(function (row) {
      if (row.table === tableId) set.add(row.indicator);
    });
    return Array.from(set).sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
  }

  function getDefaultIndicator(indicators) {
    if (!indicators.length) return null;
    var exact = indicators.filter(function (s) { return s === 'Total'; })[0];
    if (exact) return exact;
    var totalWithNum = indicators.filter(function (s) { return /^Total\d+$/.test(s); })[0];
    if (totalWithNum) return totalWithNum;
    var startsTotal = indicators.filter(function (s) { return s.indexOf('Total') === 0; })[0];
    if (startsTotal) return startsTotal;
    return indicators[0];
  }

  function baseName(ind) {
    return ind.replace(/\s*\d+$/, '');
  }

  function indicatorDisplayName(indicator, allIndicators) {
    var base = baseName(indicator);
    if (base === indicator) return indicator;
    var sameBase = allIndicators.filter(function (i) { return baseName(i) === base; });
    return sameBase.length === 1 ? base : indicator;
  }

  function onSectionChange() {
    var sectionSel = document.getElementById('section');
    var tableSel = document.getElementById('table');
    var indSel = document.getElementById('indicator');
    var submenuWrap = document.getElementById('submenu-wrap');
    var submenuSel = document.getElementById('submenu');
    var indLabel = document.getElementById('indicator-label');
    var sectionId = sectionSel.value ? parseInt(sectionSel.value, 10) : null;
    submenuWrap.style.display = 'none';
    submenuSel.innerHTML = '<option value="">— Select submenu —</option>';
    indLabel.textContent = '3. Indicator';
    if (!sectionId) {
      tableSel.disabled = true;
      tableSel.innerHTML = '<option value="">— Select section first —</option>';
      indSel.disabled = true;
      indSel.innerHTML = '<option value="">— Select table first —</option>';
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update('none');
      }
      return;
    }
    var tablesInSection = tableList.filter(function (t) {
      return t.section === sectionId && tablesWithData.has(t.id);
    });
    tableSel.disabled = false;
    tableSel.innerHTML = '<option value="">— Select table —</option>' +
      tablesInSection.map(function (t) {
        return '<option value="' + escapeHtml(t.id) + '">' + escapeHtml(t.shortTitle || t.title) + '</option>';
      }).join('');
    tableSel.value = '';
    indSel.disabled = true;
    indSel.innerHTML = '<option value="">— Select table first —</option>';
    if (chart) {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      chart.update('none');
    }
  }

  function getSubmenusForTable(tableId) {
    var indicators = getIndicatorsForTable(tableId);
    var set = new Set();
    indicators.forEach(function (ind) {
      var pos = ind.indexOf(' | ');
      if (pos > 0) set.add(ind.slice(0, pos));
    });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b); });
  }

  function onSubmenuChange() {
    var tableSel = document.getElementById('table');
    var submenuSel = document.getElementById('submenu');
    var indSel = document.getElementById('indicator');
    var tableId = tableSel.value;
    var submenu = submenuSel.value;
    if (!tableId) return;
    var allIndicators = getIndicatorsForTable(tableId);
    var indicators = submenu
      ? allIndicators.filter(function (ind) { return ind.indexOf(submenu + ' | ') === 0; })
      : allIndicators;
    indSel.disabled = false;
    indSel.innerHTML = '<option value="">— Select indicator —</option>' +
      indicators.map(function (ind) {
        var label = indicatorDisplayName(ind, indicators);
        return '<option value="' + escapeHtml(ind) + '">' + escapeHtml(label) + '</option>';
      }).join('');
    var defaultInd = getDefaultIndicator(indicators);
    indSel.value = defaultInd ? escapeHtml(defaultInd) : '';
    onIndicatorChange();
  }

  function onTableChange() {
    var tableSel = document.getElementById('table');
    var indSel = document.getElementById('indicator');
    var submenuWrap = document.getElementById('submenu-wrap');
    var submenuSel = document.getElementById('submenu');
    var indLabel = document.getElementById('indicator-label');
    var tableId = tableSel.value;
    if (!tableId) {
      submenuWrap.style.display = 'none';
      indLabel.textContent = '3. Indicator';
      indSel.disabled = true;
      indSel.innerHTML = '<option value="">— Select a table first —</option>';
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update('none');
      }
      return;
    }
    var hasCategory = categoryTables.indexOf(tableId) >= 0;
    if (hasCategory) {
      var submenus = getSubmenusForTable(tableId);
      submenuWrap.style.display = submenus.length ? 'block' : 'none';
      indLabel.textContent = '4. Indicator';
      if (submenus.length) {
        submenuSel.innerHTML = '<option value="">— All —</option>' +
          submenus.map(function (s) { return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>'; }).join('');
        submenuSel.value = '';
        submenuSel.disabled = false;
        onSubmenuChange();
      } else {
        submenuSel.innerHTML = '<option value="">— Select submenu —</option>';
        indSel.disabled = false;
        var indicators = getIndicatorsForTable(tableId);
        indSel.innerHTML = '<option value="">— Select indicator —</option>' +
          indicators.map(function (ind) {
            var label = indicatorDisplayName(ind, indicators);
            return '<option value="' + escapeHtml(ind) + '">' + escapeHtml(label) + '</option>';
          }).join('');
        var defaultInd = getDefaultIndicator(indicators);
        indSel.value = defaultInd ? escapeHtml(defaultInd) : '';
        onIndicatorChange();
      }
    } else {
      submenuWrap.style.display = 'none';
      indLabel.textContent = '3. Indicator';
      var indicators = getIndicatorsForTable(tableId);
      indSel.disabled = false;
      indSel.innerHTML = '<option value="">— Select indicator —</option>' +
        indicators.map(function (ind) {
          var label = indicatorDisplayName(ind, indicators);
          return '<option value="' + escapeHtml(ind) + '">' + escapeHtml(label) + '</option>';
        }).join('');
      var defaultInd = getDefaultIndicator(indicators);
      indSel.value = defaultInd ? escapeHtml(defaultInd) : '';
      onIndicatorChange();
    }
    if (tableId === MAP_TABLE_TEST) updateMapWithCountryData(tableId);
  }

  function onIndicatorChange() {
    const tableSel = document.getElementById('table');
    const indSel = document.getElementById('indicator');
    const tableId = tableSel.value;
    const indicator = indSel.value;
    if (!tableId || !indicator) {
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update('none');
      }
      return;
    }
    const filtered = allData.filter(function (row) {
      return row.table === tableId && row.indicator === indicator;
    });
    var labels, values;
    if (categoryTables.indexOf(tableId) >= 0 && filtered.length && filtered[0].category !== undefined) {
      var withCat = filtered.filter(function (r) { return r.category != null && String(r.category).trim() !== ''; });
      labels = withCat.map(function (r) { return String(r.category); });
      values = withCat.map(function (r) { return r.value; });
    } else {
      filtered.sort(function (a, b) { return (a.year || 0) - (b.year || 0); });
      labels = filtered.map(function (r) { return r.year; }).filter(function (y) { return isFinite(y); });
      values = filtered.map(function (r) { return r.value; });
    }
    updateChart(labels, values, indicator);
  }

  var CHART_COLOR = { bg: 'rgba(37, 99, 235, 0.5)', border: 'rgba(37, 99, 235, 0.9)', axis: '#1a202c', grid: 'rgba(0, 0, 0, 0.12)' };

  function updateChart(labels, values, indicatorName) {
    var ctx = document.getElementById('chart').getContext('2d');
    var isVerticalLabels = labels.length > 20;
    if (chart) {
      chart.config.type = chartType;
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].label = indicatorName;
      chart.data.datasets[0].backgroundColor = CHART_COLOR.bg;
      chart.data.datasets[0].borderColor = CHART_COLOR.border;
      chart.data.datasets[0].borderWidth = chartType === 'line' ? 2 : 1;
      chart.data.datasets[0].fill = false;
      chart.data.datasets[0].tension = chartType === 'line' ? 0.2 : 0;
      chart.data.datasets[0].pointRadius = chartType === 'line' ? 3 : 0;
      if (chart.options.plugins.datalabels) {
        chart.options.plugins.datalabels.rotation = isVerticalLabels ? -90 : 0;
      }
      chart.update('none');
      return;
    }
    var plugins = [];
    if (typeof ChartDataLabels !== 'undefined') plugins.push(ChartDataLabels);
    chart = new Chart(ctx, {
      type: chartType,
      plugins: plugins,
      data: {
        labels: labels,
        datasets: [{
          label: indicatorName,
          data: values,
          backgroundColor: CHART_COLOR.bg,
          borderColor: CHART_COLOR.border,
          borderWidth: chartType === 'line' ? 2 : 1,
          fill: false,
          tension: chartType === 'line' ? 0.2 : 0,
          pointRadius: chartType === 'line' ? 3 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        plugins: {
          legend: { display: false },
          datalabels: plugins.length ? {
            anchor: 'end',
            align: chartType === 'line' ? 'top' : 'top',
            rotation: isVerticalLabels ? -90 : 0,
            color: CHART_COLOR.axis,
            font: { family: 'JetBrains Mono, monospace', size: 10 },
            formatter: function (v) { return typeof v === 'number' && !isNaN(v) ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) : ''; }
          } : undefined
        },
        scales: {
          x: {
            grid: { color: CHART_COLOR.grid },
            ticks: { color: CHART_COLOR.axis, maxRotation: isVerticalLabels ? 90 : 45 },
            title: { display: true, text: 'Year (financial year start)', color: CHART_COLOR.axis }
          },
          y: {
            beginAtZero: true,
            grid: { color: CHART_COLOR.grid },
            ticks: { color: CHART_COLOR.axis },
            title: { display: true, text: 'Value', color: CHART_COLOR.axis }
          }
        }
      }
    });
  }

  function getCountryDataForMap(tableId) {
    var rows = allData.filter(function (r) { return r.table === tableId; });
    if (rows.length === 0) return { valuesByIso: {}, year: null, min: 0, max: 1 };
    var byYear = {};
    rows.forEach(function (r) {
      if (!byYear[r.year]) byYear[r.year] = [];
      byYear[r.year].push(r);
    });
    var years = Object.keys(byYear).map(Number).filter(function (y) { return isFinite(y) && y > 0; }).sort(function (a, b) { return a - b; });
    var latestYear = years[years.length - 1];
    if (latestYear == null) return { valuesByIso: {}, year: null, min: 0, max: 1 };
    var yearRows = rows.filter(function (r) { return r.year === latestYear; });
    var valuesByIso = {};
    var min = Infinity, max = -Infinity;
    yearRows.forEach(function (r) {
      var name = r.indicator;
      if (/^Total\d*$/.test(name) || /^Other\d*$/.test(name)) return;
      var iso = countryToIso[name] || countryToIso[name.replace(/\d+$/, '')];
      if (!iso) return;
      var v = Number(r.value);
      if (!isFinite(v)) return;
      valuesByIso[iso] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    });
    if (min === Infinity) min = 0;
    if (max === -Infinity || max === min) max = min + 1;
    return { valuesByIso: valuesByIso, year: latestYear, min: min, max: max };
  }

  function valueToColor(val, min, max) {
    if (max === min) return '#93c5fd';
    var t = (val - min) / (max - min);
    var r = Math.round(147 + (30 - 147) * t);
    var g = Math.round(197 + (64 - 197) * t);
    var b = Math.round(253 + (175 - 253) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function updateMapWithCountryData(tableId) {
    if (typeof L === 'undefined') return;
    var data = getCountryDataForMap(tableId);
    var mapEl = document.getElementById('map');
    var titleEl = document.getElementById('map-title');
    var legendEl = document.getElementById('map-legend');
    var legendScale = document.getElementById('map-legend-scale');
    var legendLabels = document.getElementById('map-legend-labels');
    if (!mapEl || Object.keys(data.valuesByIso).length === 0) {
      if (titleEl) titleEl.textContent = 'Map (select table 1.3 for country data)';
      if (legendEl) legendEl.style.display = 'none';
      return;
    }
    if (titleEl) titleEl.textContent = 'Table ' + tableId.replace('_', '.') + ' by country (' + (data.year || '') + ')';
    if (!leafletMap) {
      leafletMap = L.map('map', { center: [20, 0], zoom: 2, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(leafletMap);
    }
    if (mapGeoLayer) {
      leafletMap.removeLayer(mapGeoLayer);
      mapGeoLayer = null;
    }
    fetch(GEOJSON_URL)
      .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('GeoJSON ' + res.status)); })
      .then(function (geojson) {
        mapGeoLayer = L.geoJSON(geojson, {
          style: function (feature) {
            var iso = feature.properties && (feature.properties.ISO_A2 || feature.properties.iso_a2);
            if (!iso || typeof iso !== 'string' || iso.length !== 2 || iso === '-99') return { fillColor: '#e5e7eb', fillOpacity: 0.6, weight: 1, color: '#9ca3af' };
            var val = data.valuesByIso[iso];
            var fill = val != null ? valueToColor(val, data.min, data.max) : '#e5e7eb';
            return { fillColor: fill, fillOpacity: 0.75, weight: 1, color: '#94a3b8' };
          }
        }).addTo(leafletMap);
        setTimeout(function () { if (leafletMap) leafletMap.invalidateSize(); }, 100);
        legendEl.style.display = 'block';
        document.getElementById('map-legend-title').textContent = 'Outcomes (' + (data.year || '') + ')';
        var steps = 5;
        legendScale.innerHTML = '';
        legendLabels.innerHTML = '';
        for (var i = 0; i <= steps; i++) {
          var t = i / steps;
          var v = data.min + t * (data.max - data.min);
          var span = document.createElement('span');
          span.style.background = valueToColor(v, data.min, data.max);
          legendScale.appendChild(span);
        }
        function fmtNum(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
        legendLabels.innerHTML = '<span>' + fmtNum(Math.round(data.min)) + '</span><span>' + fmtNum(Math.round(data.max)) + '</span>';
      })
      .catch(function () {
        if (titleEl) titleEl.textContent = 'Map (load failed)';
        if (legendEl) legendEl.style.display = 'none';
      });
  }

  function loadData() {
    var sectionSel = document.getElementById('section');
    var tableSel = document.getElementById('table');
    var indSel = document.getElementById('indicator');
    sectionSel.innerHTML = '<option value="">— Loading —</option>';
    sectionSel.classList.add('loading');

    function done(errMsg) {
      sectionSel.classList.remove('loading');
      if (errMsg) {
        sectionSel.innerHTML = '<option value="">' + errMsg + '</option>';
        sectionSel.classList.add('error');
      }
    }

    Promise.all([
      fetch(TABLES_URL).then(function (r) {
        if (!r.ok) throw new Error('tables.json ' + r.status);
        return r.json();
      }),
      fetch(DATA_URL).then(function (r) {
        if (!r.ok) throw new Error('indicators.csv ' + r.status);
        return r.text();
      }),
      fetch(CATEGORY_TABLES_URL).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    ]).then(function (results) {
      try {
        tableList = results[0];
        if (!Array.isArray(tableList)) throw new Error('Invalid tables.json');
        allData = parseCSV(results[1]);
        categoryTables = Array.isArray(results[2]) ? results[2] : [];
        var dataTablePattern = /^\d+_\d+$/;
        tablesWithData = new Set();
        allData.forEach(function (row) {
          if (dataTablePattern.test(row.table || '')) tablesWithData.add(row.table);
        });
        var sectionsWithData = new Set();
        tableList.forEach(function (t) {
          if (tablesWithData.has(t.id) && t.section != null) sectionsWithData.add(t.section);
        });
        var sectionOrder = [1, 2, 3, 4, 5, 6, 7];
        sectionSel.innerHTML = '<option value="">— Select section —</option>' +
          sectionOrder.filter(function (s) { return sectionsWithData.has(s); }).map(function (s) {
            var label = SECTION_LABELS[s] || ('Section ' + s);
            return '<option value="' + s + '">' + escapeHtml(label) + '</option>';
          }).join('');
        sectionSel.classList.remove('loading');
        tableSel.innerHTML = '<option value="">— Select section first —</option>';
        tableSel.disabled = true;
        sectionSel.addEventListener('change', onSectionChange);
        tableSel.addEventListener('change', onTableChange);
        document.getElementById('submenu').addEventListener('change', onSubmenuChange);
        indSel.addEventListener('change', onIndicatorChange);
        updateKpiCards();
        document.getElementById('chart-type-bar').addEventListener('click', function () {
          chartType = 'bar';
          document.getElementById('chart-type-bar').classList.add('active');
          document.getElementById('chart-type-bar').setAttribute('aria-pressed', 'true');
          document.getElementById('chart-type-line').classList.remove('active');
          document.getElementById('chart-type-line').setAttribute('aria-pressed', 'false');
          if (chart) { chart.config.type = 'bar'; chart.update('none'); }
        });
        document.getElementById('chart-type-line').addEventListener('click', function () {
          chartType = 'line';
          document.getElementById('chart-type-line').classList.add('active');
          document.getElementById('chart-type-line').setAttribute('aria-pressed', 'true');
          document.getElementById('chart-type-bar').classList.remove('active');
          document.getElementById('chart-type-bar').setAttribute('aria-pressed', 'false');
          if (chart) { chart.config.type = 'line'; chart.update('none'); }
        });
        if (sectionsWithData.has(1) && tablesWithData.has('1_0')) {
          sectionSel.value = '1';
          onSectionChange();
          tableSel.value = '1_0';
          onTableChange();
        }
        updateMapWithCountryData(MAP_TABLE_TEST);
      } catch (e) {
        done('Error: ' + (e.message || 'invalid data'));
        console.error(e);
      }
    }).catch(function (err) {
      done('Error loading data');
      console.error(err);
    });
  }

  loadData();
})();
