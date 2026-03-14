(function () {
  'use strict';

  var base = (function () {
    var href = window.location.href;
    var last = href.lastIndexOf('/');
    return last >= 0 ? href.slice(0, last + 1) : '';
  })();
  var CACHE_BUST = '?v=3';
  var TABLES_URL = base + 'data/tables.json' + CACHE_BUST;
  var DATA_URL = base + 'data/indicators.csv' + CACHE_BUST;
  var CATEGORY_TABLES_URL = base + 'data/category_tables.json' + CACHE_BUST;
  var FOOTNOTES_URL = base + 'data/table_footnotes.json' + CACHE_BUST;
  var KPI_CANDIDATES_URL = base + 'data/kpi_candidates.json' + CACHE_BUST;
  var SUMMARIES_URL = base + 'data/by_country/summaries.json' + CACHE_BUST;
  var categoryTables = [];
  var tableFootnotes = {};
  var kpiCandidates = {};
  var countrySummaries = [];
  var spotlightCycleIndex = 0;
  var spotlightCycleTimer = null;
  var selectedSpotlightCountry = null;
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
  var KPI_INDICATORS = [];
  var MAP_TABLE_TEST = '1_3';
  var MAP_TABLES = ['1_3', '1_6', '1_8', '1_10', '1_12', '1_14', '1_15', '1_16', '1_17', '2_4', '3_1', '3_3', '4_1', '4_4', '6_0'];
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
  var mapLabelLayer = null;
  var mapDonutChart = null;
  var mapViewMode = 'map';
  var currentMapData = null;
  var lastSpotlightCountryName = null;
  var DONUT_COLORS = ['#2563eb', '#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#1e40af', '#1e3a8a', '#3730a3', '#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#4338ca', '#5b21b6', '#7c3aed'];

  function doughnutColors(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(DONUT_COLORS[i % DONUT_COLORS.length]);
    return out;
  }

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

  function getTop5IndicatorsForTable(tableId) {
    if (!tableId || !kpiCandidates[tableId]) return [];
    return kpiCandidates[tableId].slice(0, 5);
  }

  function kpiTitleDisplay(name) {
    if (!name || name === '—') return name;
    return name.replace(/\d+$/, '').trim() || name;
  }

  function setKpiCardTitles(indicators) {
    for (var i = 0; i < 5; i++) {
      var el = document.getElementById('kpi-' + i + '-title');
      if (el) el.textContent = kpiTitleDisplay(indicators[i]) || '—';
    }
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

  function abbreviateSparkValue(v) {
    var n = Number(v);
    if (!isFinite(n)) return '';
    if (n >= 1e6) return Math.round(n / 1e6) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return Math.round(n).toString();
  }

  function drawSparkline(canvasId, values) {
    var el = document.getElementById(canvasId);
    if (!el) return;
    if (!values || values.length === 0) {
      var ctx = el.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, el.width, el.height);
      return;
    }
    var dpr = window.devicePixelRatio || 1;
    var w = el.parentElement.clientWidth || 120;
    var labelTop = 16;
    var lineBottom = 40;
    var h = 48;
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
    var y0 = lineBottom - pad;
    var lineH = lineBottom - labelTop - 2;
    var step = values.length > 1 ? (x1 - x0) / (values.length - 1) : 0;
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    var points = [];
    values.forEach(function (v, i) {
      var x = x0 + i * step;
      var y = y0 - ((v - min) / range) * lineH;
      points.push({ x: x, y: y, v: v });
    });
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      var p0 = points[i - 1];
      var p1 = points[i];
      var cpx = (p0.x + p1.x) / 2;
      var cpy = (p0.y + p1.y) / 2;
      var dx = (p1.x - p0.x) * 0.2;
      var dy = (p1.y - p0.y) * 0.2;
      ctx.quadraticCurveTo(cpx - dx, cpy - dy, p1.x, p1.y);
    }
    ctx.stroke();
    ctx.fillStyle = '#60a5fa';
    points.forEach(function (p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = '8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    points.forEach(function (p) {
      var label = abbreviateSparkValue(p.v);
      if (!label) return;
      var textY = p.y - 6;
      if (textY < labelTop) textY = labelTop;
      ctx.fillText(label, p.x, textY);
    });
  }

  function updateKpiCards() {
    var data = getKpiData();
    for (var i = 0; i < 5; i++) {
      var d = data[i];
      var valEl = document.getElementById('kpi-' + i + '-val');
      var changeEl = document.getElementById('kpi-' + i + '-change');
      if (valEl) valEl.textContent = d && d.latest != null ? d.latest.toLocaleString('en-AU', { maximumFractionDigits: 0 }) : '—';
      if (changeEl) {
        changeEl.textContent = '';
        changeEl.className = 'kpi-change neutral';
        if (d && d.pct != null && isFinite(d.pct)) {
          changeEl.textContent = (d.pct >= 0 ? '+' : '') + d.pct.toFixed(1) + '%';
          changeEl.className = 'kpi-change ' + (d.pct > 0 ? 'positive' : d.pct < 0 ? 'negative' : 'neutral');
        }
      }
      drawSparkline('kpi-' + i + '-spark', d && d.values ? d.values : []);
    }
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
    indLabel.innerHTML = '<img src="' + base + 'number-3.png" alt="3" class="step-num-img"> Indicator';
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
      indLabel.innerHTML = '<img src="' + base + 'number-3.png" alt="3" class="step-num-img"> Indicator';
      indSel.disabled = true;
      indSel.innerHTML = '<option value="">— Select a table first —</option>';
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update('none');
      }
      updateTableNotes(null);
      KPI_TABLE = '';
      KPI_INDICATORS = [];
      setKpiCardTitles([]);
      updateKpiCards();
      return;
    }
    var hasCategory = categoryTables.indexOf(tableId) >= 0;
    if (hasCategory) {
      var submenus = getSubmenusForTable(tableId);
      submenuWrap.style.display = submenus.length ? 'inline-flex' : 'none';
      indLabel.innerHTML = '<img src="' + base + 'number-4.png" alt="4" class="step-num-img"> Indicator';
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
      indLabel.innerHTML = '<img src="' + base + 'number-3.png" alt="3" class="step-num-img"> Indicator';
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
    KPI_TABLE = tableId;
    KPI_INDICATORS = getTop5IndicatorsForTable(tableId);
    setKpiCardTitles(KPI_INDICATORS);
    updateKpiCards();
    updateTableNotes(tableId);
  }

  function formatPercentagesInNotes(text) {
    return text.replace(/([+-])(\d+\.?\d*)(?=\s|$|,|\))/g, function (_, sign, num) {
      var n = parseFloat(sign + num);
      if (n >= -100 && n <= 100) return sign + num + '%';
      return sign + num;
    }).replace(/\b(\d{1,2}\.\d+)(?=\s|$|,)(?!%)/g, function (m) {
      var n = parseFloat(m);
      if (n >= 0 && n <= 100) return m + '%';
      return m;
    });
  }

  function formatBoldNumbersInNotes(text) {
    return text.replace(/(\d+\.?\d*)/g, '<b>$1</b>');
  }

  function updateTableNotes(tableId) {
    var el = document.getElementById('table-notes');
    if (!el) return;
    var lines = tableId && tableFootnotes[tableId];
    if (lines && lines.length) {
      el.innerHTML = lines.map(function (line) {
        var escaped = escapeHtml(line);
        var formatted = formatPercentagesInNotes(escaped);
        formatted = formatBoldNumbersInNotes(formatted);
        return '<p>' + formatted + '</p>';
      }).join('');
    } else {
      el.innerHTML = '<p class="table-notes-empty">Select a table to view notes and sources.</p>';
    }
  }

  function setChartTitle() {
    var sectionSel = document.getElementById('section');
    var tableSel = document.getElementById('table');
    var submenuWrap = document.getElementById('submenu-wrap');
    var submenuSel = document.getElementById('submenu');
    var indSel = document.getElementById('indicator');
    var titleEl = document.getElementById('chart-title');
    if (!titleEl) return;
    var parts = [];
    if (sectionSel && sectionSel.selectedIndex >= 0) {
      var s = sectionSel.options[sectionSel.selectedIndex].text;
      if (s) parts.push(s);
    }
    if (tableSel && tableSel.selectedIndex >= 0) {
      var t = tableSel.options[tableSel.selectedIndex].text;
      if (t) parts.push(t);
    }
    if (submenuWrap && submenuWrap.style.display !== 'none' && submenuSel && submenuSel.selectedIndex >= 0 && submenuSel.value) {
      var sm = submenuSel.options[submenuSel.selectedIndex].text;
      if (sm) parts.push(sm);
    }
    if (indSel && indSel.selectedIndex >= 0) {
      var i = indSel.options[indSel.selectedIndex].text;
      if (i) parts.push(i);
    }
    titleEl.textContent = parts.length ? parts.join(' · ') : '';
  }

  var SPOTLIGHT_FADE_MS = 500;
  var MAP_HIGHLIGHT_BORDER = '#facc15';

  function highlightCountryOnMap(countryName) {
    if (!mapGeoLayer || !currentMapData) return;
    var targetIso = countryName ? (countryToIso[countryName] || countryToIso[countryName.replace(/\d+$/, '')]) : null;
    if (targetIso) targetIso = String(targetIso).toUpperCase();
    mapGeoLayer.eachLayer(function (layer) {
      var iso = layer.feature.properties && (layer.feature.properties.ISO_A2 || layer.feature.properties.iso_a2);
      if (!iso) return;
      iso = String(iso).toUpperCase();
      var val = currentMapData.valuesByIso[iso];
      var fill = val != null ? valueToColor(val, currentMapData.min, currentMapData.max) : '#e5e7eb';
      var isHighlight = targetIso && iso === targetIso;
      layer.setStyle({
        fillColor: fill,
        fillOpacity: 0.75,
        weight: isHighlight ? 1.2 : 1,
        color: isHighlight ? MAP_HIGHLIGHT_BORDER : '#94a3b8'
      });
    });
  }

  function updateCountrySpotlight(countryName) {
    var countryEl = document.getElementById('spotlight-country');
    var textEl = document.getElementById('spotlight-text');
    var contentEl = document.getElementById('spotlight-content');
    if (!countryEl || !textEl) return;
    function apply() {
      var displayedName = null;
      if (countryName) {
        selectedSpotlightCountry = countryName;
        var entry = countrySummaries.filter(function (s) { return s.name === countryName; })[0];
        if (entry) {
          displayedName = entry.name;
          countryEl.textContent = (entry.name || '').replace(/\s*[—–-]\s*$/, '').trim();
          countryEl.style.display = '';
          textEl.textContent = entry.summary || '';
        } else {
          countryEl.textContent = '';
          countryEl.style.display = 'none';
          textEl.textContent = countrySummaries.length ? 'Select a country from the Indicator menu or click the map.' : 'Country summaries loading…';
        }
        lastSpotlightCountryName = displayedName;
        return displayedName;
      }
      selectedSpotlightCountry = null;
      if (!countrySummaries.length) {
        countryEl.textContent = '';
        countryEl.style.display = 'none';
        textEl.textContent = 'Country summaries unavailable.';
        lastSpotlightCountryName = null;
        return null;
      }
      var idx = spotlightCycleIndex % countrySummaries.length;
      var entry = countrySummaries[idx];
      displayedName = entry.name;
      countryEl.textContent = (entry.name || '').replace(/\s*[—–-]\s*$/, '').trim();
      countryEl.style.display = '';
      textEl.textContent = entry.summary || '';
      spotlightCycleIndex = (spotlightCycleIndex + 1) % countrySummaries.length;
      lastSpotlightCountryName = displayedName;
      return displayedName;
    }
    if (contentEl) {
      contentEl.style.opacity = '0';
      setTimeout(function () {
        var name = apply();
        contentEl.style.opacity = '1';
        highlightCountryOnMap(name);
      }, SPOTLIGHT_FADE_MS);
    } else {
      var name = apply();
      highlightCountryOnMap(name);
    }
  }

  function startSpotlightCycle() {
    if (spotlightCycleTimer) return;
    spotlightCycleTimer = setInterval(function () {
      if (selectedSpotlightCountry) return;
      updateCountrySpotlight(null);
    }, 18000);
    updateCountrySpotlight(null);
  }

  function onIndicatorChange() {
    const tableSel = document.getElementById('table');
    const indSel = document.getElementById('indicator');
    const tableId = tableSel.value;
    const indicator = indSel.value;
    setChartTitle();
    if (MAP_TABLES.indexOf(tableId) >= 0 && indicator && countrySummaries.some(function (s) { return s.name === indicator; })) {
      updateCountrySpotlight(indicator);
    } else {
      selectedSpotlightCountry = null;
      updateCountrySpotlight(null);
      if (!spotlightCycleTimer) startSpotlightCycle();
    }
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
  var LINE_POINT_BLUE = '#60a5fa';

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
      chart.data.datasets[0].tension = chartType === 'line' ? 0.5 : 0;
      chart.data.datasets[0].pointRadius = chartType === 'line' ? 2 : 0;
      chart.data.datasets[0].pointHoverRadius = chartType === 'line' ? 4 : 0;
      chart.data.datasets[0].pointBackgroundColor = chartType === 'line' ? LINE_POINT_BLUE : undefined;
      chart.data.datasets[0].pointBorderColor = chartType === 'line' ? LINE_POINT_BLUE : undefined;
      chart.data.datasets[0].pointBorderWidth = chartType === 'line' ? 1 : 0;
      if (chart.options.layout) chart.options.layout.padding = { top: 56, right: 8 };
      if (chart.options.plugins.datalabels) {
        chart.options.plugins.datalabels.rotation = isVerticalLabels ? -90 : 0;
      }
      if (chart.options.scales && chart.options.scales.y) chart.options.scales.y.grace = '8%';
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
          tension: chartType === 'line' ? 0.5 : 0,
          pointRadius: chartType === 'line' ? 2 : 0,
          pointHoverRadius: chartType === 'line' ? 4 : 0,
          pointBackgroundColor: chartType === 'line' ? LINE_POINT_BLUE : undefined,
          pointBorderColor: chartType === 'line' ? LINE_POINT_BLUE : undefined,
          pointBorderWidth: chartType === 'line' ? 1 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 56, right: 8 } },
        plugins: {
          legend: { display: false },
          datalabels: plugins.length ? {
            anchor: 'end',
            align: chartType === 'line' ? 'top' : 'top',
            rotation: isVerticalLabels ? -90 : 0,
            color: CHART_COLOR.axis,
            font: { family: 'JetBrains Mono, monospace', size: 10 },
            formatter: function (v, ctx) {
              if (typeof v !== 'number' || isNaN(v)) return '';
              if (v > 0 && v <= 1) return (v * 100).toFixed(1) + '%';
              if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
              var data = ctx.dataset && ctx.dataset.data;
              if (data && data.length && data.every(function (x) { return typeof x === 'number' && x >= 0 && x <= 100; })) return v.toFixed(1) + '%';
              return v;
            }
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
            grace: '8%',
            grid: { color: CHART_COLOR.grid },
            ticks: { color: CHART_COLOR.axis },
            title: { display: false }
          }
        }
      }
    });
  }

  function getMapAvailableYears(tableId) {
    var rows = allData.filter(function (r) { return r.table === tableId; });
    var set = new Set();
    rows.forEach(function (r) { if (isFinite(r.year) && r.year > 0) set.add(r.year); });
    return Array.from(set).sort(function (a, b) { return a - b; });
  }

  function getCountryDataForMap(tableId, year) {
    var rows = allData.filter(function (r) { return r.table === tableId; });
    if (rows.length === 0) return { valuesByIso: {}, year: null, min: 0, max: 1, countryList: [] };
    var years = getMapAvailableYears(tableId);
    var targetYear = year != null && years.indexOf(year) >= 0 ? year : years[years.length - 1];
    if (targetYear == null) return { valuesByIso: {}, year: null, min: 0, max: 1, countryList: [] };
    var yearRows = rows.filter(function (r) { return r.year === targetYear; });
    var valuesByIso = {};
    var countryList = [];
    var min = Infinity, max = -Infinity;
    yearRows.forEach(function (r) {
      var name = r.indicator;
      if (/^Total\d*$/.test(name) || /^Other\d*$/.test(name)) return;
      var iso = countryToIso[name] || countryToIso[name.replace(/\d+$/, '')];
      if (!iso) return;
      var v = Number(r.value);
      if (!isFinite(v)) return;
      valuesByIso[iso] = v;
      countryList.push({ name: name, value: v });
      if (v < min) min = v;
      if (v > max) max = v;
    });
    countryList.sort(function (a, b) { return b.value - a.value; });
    if (min === Infinity) min = 0;
    if (max === -Infinity || max === min) max = min + 1;
    return { valuesByIso: valuesByIso, year: targetYear, min: min, max: max, countryList: countryList };
  }

  function valueToColor(val, min, max) {
    if (max === min) return '#93c5fd';
    var t = (val - min) / (max - min);
    var r = Math.round(147 + (30 - 147) * t);
    var g = Math.round(197 + (64 - 197) * t);
    var b = Math.round(253 + (175 - 253) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function getMapTableTitle(tableId) {
    var t = tableList.filter(function (x) { return x.id === tableId; })[0];
    return t ? (t.shortTitle || t.title || tableId) : tableId;
  }

  function updateMapDonutChart(countryList) {
    var canvas = document.getElementById('map-donut-chart');
    if (!canvas || !countryList.length) return;
    var labels = countryList.map(function (c) { return c.name; });
    var values = countryList.map(function (c) { return c.value; });
    var fmt = function (v) { return typeof v === 'number' && !isNaN(v) ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) : ''; };
    if (mapDonutChart) {
      mapDonutChart.data.labels = labels;
      mapDonutChart.data.datasets[0].data = values;
      mapDonutChart.data.datasets[0].backgroundColor = doughnutColors(labels.length);
      mapDonutChart.update('none');
      return;
    }
    var plugins = [];
    if (typeof ChartDataLabels !== 'undefined') plugins.push(ChartDataLabels);
    mapDonutChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      plugins: plugins,
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: doughnutColors(labels.length),
          borderColor: '#fff',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: { display: true, position: 'right' },
          datalabels: plugins.length ? { color: '#fff', font: { size: 9 }, formatter: fmt } : undefined
        }
      }
    });
  }

  function updateMapWithCountryData(tableId, year) {
    if (typeof L === 'undefined') return;
    var mapTableSel = document.getElementById('map-table');
    var mapYearSel = document.getElementById('map-year');
    if (!tableId && mapTableSel) tableId = mapTableSel.value || MAP_TABLE_TEST;
    var years = getMapAvailableYears(tableId);
    if (years.length > 0 && mapYearSel) {
      mapYearSel.innerHTML = years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
      var target = year != null && years.indexOf(year) >= 0 ? year : years[years.length - 1];
      mapYearSel.value = target != null ? target : '';
      mapYearSel.disabled = false;
    } else if (mapYearSel) {
      mapYearSel.innerHTML = '<option value="">—</option>';
      mapYearSel.disabled = true;
    }
    var data = getCountryDataForMap(tableId, year != null ? year : (years.length ? years[years.length - 1] : null));
    var mapEl = document.getElementById('map');
    var mapInner = document.getElementById('map-inner');
    var mapDonutWrap = document.getElementById('map-donut-wrap');
    var titleEl = document.getElementById('map-title');
    var legendEl = document.getElementById('map-legend');
    var legendScale = document.getElementById('map-legend-scale');
    var legendLabels = document.getElementById('map-legend-labels');
    if (!mapEl || Object.keys(data.valuesByIso).length === 0) {
      if (titleEl) titleEl.textContent = 'Map (select a table above for country data)';
      if (legendEl) legendEl.style.display = 'none';
      if (mapInner) mapInner.style.display = '';
      if (mapDonutWrap) mapDonutWrap.style.display = 'none';
      return;
    }
    if (titleEl) titleEl.textContent = getMapTableTitle(tableId) + (data.year ? ' (' + data.year + ')' : '');
    if (mapViewMode === 'donut') {
      if (mapInner) mapInner.style.display = 'none';
      if (mapDonutWrap) mapDonutWrap.style.display = 'flex';
      updateMapDonutChart(data.countryList || []);
      if (legendEl) legendEl.style.display = 'none';
      return;
    }
    if (mapInner) mapInner.style.display = '';
    if (mapDonutWrap) mapDonutWrap.style.display = 'none';
    if (!leafletMap) {
      leafletMap = L.map('map', { center: [20, 0], zoom: 1, zoomControl: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMap);
      L.control.zoom({ position: 'bottomleft' }).addTo(leafletMap);
    }
    if (mapLabelLayer) {
      leafletMap.removeLayer(mapLabelLayer);
      mapLabelLayer = null;
    }
    if (mapGeoLayer) {
      leafletMap.removeLayer(mapGeoLayer);
      mapGeoLayer = null;
    }
    currentMapData = data;
    function fmtNum(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
    var isoToCountryName = {};
    data.countryList.forEach(function (c) {
      var iso = countryToIso[c.name] || countryToIso[c.name.replace(/\d+$/, '')];
      if (iso) isoToCountryName[String(iso).toUpperCase()] = c.name;
    });
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
          },
          onEachFeature: function (feature, layer) {
            var iso = feature.properties && (feature.properties.ISO_A2 || feature.properties.iso_a2);
            if (iso && typeof iso !== 'string') iso = String(iso);
            var name = feature.properties && (feature.properties.ADMIN || feature.properties.name || iso);
            var val = iso && data.valuesByIso[iso];
            if (val != null && isFinite(val)) {
              layer.bindTooltip(name + ': ' + fmtNum(Math.round(val)), { permanent: false, direction: 'top', className: 'map-tooltip' });
              layer.on('click', function () {
                var isoKey = (iso && typeof iso === 'string') ? iso.toUpperCase() : iso;
                var countryName = isoToCountryName[isoKey] || isoToCountryName[iso];
                if (!countryName) return;
                var mapTableEl = document.getElementById('map-table');
                var mapTableId = mapTableEl ? mapTableEl.value : null;
                if (!mapTableId || MAP_TABLES.indexOf(mapTableId) < 0) return;
                var tbl = tableList.filter(function (t) { return t.id === mapTableId; })[0];
                if (!tbl || !sectionsWithData.has(tbl.section)) return;
                updateCountrySpotlight(countryName);
                highlightCountryOnMap(countryName);
                var sectionSel = document.getElementById('section');
                var tableSel = document.getElementById('table');
                var indSel = document.getElementById('indicator');
                sectionSel.value = String(tbl.section);
                onSectionChange();
                setTimeout(function () {
                  tableSel.value = mapTableId;
                  onTableChange();
                  setTimeout(function () {
                    var opts = indSel.options;
                    for (var j = 0; j < opts.length; j++) {
                      if (opts[j].value === countryName) {
                        indSel.value = countryName;
                        break;
                      }
                    }
                    onIndicatorChange();
                  }, 50);
                }, 50);
              });
              layer.on('add', function () {
                if (layer._path) layer._path.style.cursor = 'pointer';
              });
              if (layer._path) layer._path.style.cursor = 'pointer';
            }
          }
        }).addTo(leafletMap);
        mapLabelLayer = L.layerGroup();
        mapGeoLayer.eachLayer(function (layer) {
          var feature = layer.feature;
          var iso = feature.properties && (feature.properties.ISO_A2 || feature.properties.iso_a2);
          if (!iso || typeof iso !== 'string' || iso.length !== 2) return;
          var val = data.valuesByIso[iso];
          if (val == null || !isFinite(val)) return;
          var center = layer.getBounds().getCenter();
          var icon = L.divIcon({
            html: '<span class="map-country-value">' + fmtNum(Math.round(val)) + '</span>',
            className: 'map-value-label',
            iconSize: null,
            iconAnchor: [0, 0]
          });
          L.marker(center, { icon: icon }).addTo(mapLabelLayer);
        });
        mapLabelLayer.addTo(leafletMap);
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
        legendLabels.innerHTML = '<span>' + fmtNum(Math.round(data.min)) + '</span><span>' + fmtNum(Math.round(data.max)) + '</span>';
        highlightCountryOnMap(lastSpotlightCountryName);
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
      fetch(CATEGORY_TABLES_URL).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      fetch(FOOTNOTES_URL).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
      fetch(KPI_CANDIDATES_URL).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
      fetch(SUMMARIES_URL).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    ]).then(function (results) {
      try {
        tableList = results[0];
        if (!Array.isArray(tableList)) throw new Error('Invalid tables.json');
        allData = parseCSV(results[1]);
        categoryTables = Array.isArray(results[2]) ? results[2] : [];
        tableFootnotes = results[3] && typeof results[3] === 'object' ? results[3] : {};
        kpiCandidates = results[4] && typeof results[4] === 'object' ? results[4] : {};
        countrySummaries = Array.isArray(results[5]) ? results[5] : [];
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
        var mapTableEl = document.getElementById('map-table');
        var mapYearEl = document.getElementById('map-year');
        var mapTableOpts = MAP_TABLES.filter(function (id) { return tablesWithData.has(id); });
        if (mapTableEl && mapTableOpts.length) {
          mapTableEl.innerHTML = mapTableOpts.map(function (id) {
            var title = getMapTableTitle(id);
            return '<option value="' + escapeHtml(id) + '">' + escapeHtml(title) + '</option>';
          }).join('');
          mapTableEl.value = mapTableOpts.indexOf(MAP_TABLE_TEST) >= 0 ? MAP_TABLE_TEST : mapTableOpts[0];
          mapTableEl.addEventListener('change', function () {
            var y = mapYearEl && mapYearEl.value ? parseInt(mapYearEl.value, 10) : null;
            updateMapWithCountryData(mapTableEl.value, y);
          });
        }
        if (mapYearEl) mapYearEl.addEventListener('change', function () {
          var y = mapYearEl.value ? parseInt(mapYearEl.value, 10) : null;
          updateMapWithCountryData(mapTableEl ? mapTableEl.value : MAP_TABLE_TEST, y);
        });
        updateKpiCards();
        startSpotlightCycle();
        document.getElementById('chart-type-bar').addEventListener('click', function () {
          chartType = 'bar';
          document.getElementById('chart-type-bar').classList.add('active');
          document.getElementById('chart-type-bar').setAttribute('aria-pressed', 'true');
          document.getElementById('chart-type-line').classList.remove('active');
          document.getElementById('chart-type-line').setAttribute('aria-pressed', 'false');
          if (chart) {
            chart.config.type = 'bar';
            var ds = chart.data.datasets[0];
            if (ds) { ds.tension = 0; ds.pointRadius = 0; ds.pointHoverRadius = 0; ds.borderWidth = 1; ds.pointBackgroundColor = undefined; ds.pointBorderColor = undefined; ds.pointBorderWidth = 0; }
            chart.update('none');
          }
        });
        document.getElementById('chart-type-line').addEventListener('click', function () {
          chartType = 'line';
          document.getElementById('chart-type-line').classList.add('active');
          document.getElementById('chart-type-line').setAttribute('aria-pressed', 'true');
          document.getElementById('chart-type-bar').classList.remove('active');
          document.getElementById('chart-type-bar').setAttribute('aria-pressed', 'false');
          if (chart) {
            chart.config.type = 'line';
            var ds = chart.data.datasets[0];
            if (ds) {
              ds.borderWidth = 2;
              ds.tension = 0.5;
              ds.pointRadius = 2;
              ds.pointHoverRadius = 4;
              ds.pointBackgroundColor = LINE_POINT_BLUE;
              ds.pointBorderColor = LINE_POINT_BLUE;
              ds.pointBorderWidth = 1;
            }
            chart.update('none');
          }
        });
        var downloadPngEl = document.getElementById('download-png');
        var downloadCsvEl = document.getElementById('download-csv');
        if (downloadPngEl) downloadPngEl.addEventListener('click', function () {
          if (!chart) return;
          var canvas = document.getElementById('chart');
          if (!canvas) return;
          var link = document.createElement('a');
          link.download = 'chart.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        });
        function doDownloadCsv() {
          var tableId = tableSel.value;
          var indicator = indSel.value;
          if (!tableId || !indicator || !chart || !chart.data || !chart.data.labels) return;
          var labels = chart.data.labels;
          var values = chart.data.datasets[0] && chart.data.datasets[0].data ? chart.data.datasets[0].data : [];
          var rows = ['year,value'];
          for (var i = 0; i < labels.length; i++) {
            var y = labels[i];
            var v = values[i] != null ? values[i] : '';
            rows.push(String(y) + ',' + String(v));
          }
          var csv = rows.join('\n');
          var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
          var link = document.createElement('a');
          link.download = 'data_' + tableId + '_' + (indicator.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)) + '.csv';
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }
        if (downloadCsvEl) downloadCsvEl.addEventListener('click', doDownloadCsv);
        var footerDownloadCsvEl = document.getElementById('footer-download-csv');
        if (footerDownloadCsvEl) footerDownloadCsvEl.addEventListener('click', doDownloadCsv);
        var mapViewMapBtn = document.getElementById('map-view-map');
        var mapViewDonutBtn = document.getElementById('map-view-donut');
        if (mapViewMapBtn) mapViewMapBtn.addEventListener('click', function () {
          mapViewMode = 'map';
          mapViewMapBtn.classList.add('active');
          mapViewMapBtn.setAttribute('aria-pressed', 'true');
          if (mapViewDonutBtn) { mapViewDonutBtn.classList.remove('active'); mapViewDonutBtn.setAttribute('aria-pressed', 'false'); }
          var mt = document.getElementById('map-table');
          var my = document.getElementById('map-year');
          updateMapWithCountryData(mt && mt.value ? mt.value : MAP_TABLE_TEST, my && my.value ? parseInt(my.value, 10) : null);
        });
        if (mapViewDonutBtn) mapViewDonutBtn.addEventListener('click', function () {
          mapViewMode = 'donut';
          mapViewDonutBtn.classList.add('active');
          mapViewDonutBtn.setAttribute('aria-pressed', 'true');
          if (mapViewMapBtn) { mapViewMapBtn.classList.remove('active'); mapViewMapBtn.setAttribute('aria-pressed', 'false'); }
          var mt = document.getElementById('map-table');
          var my = document.getElementById('map-year');
          updateMapWithCountryData(mt && mt.value ? mt.value : MAP_TABLE_TEST, my && my.value ? parseInt(my.value, 10) : null);
        });
        if (sectionsWithData.has(1) && tablesWithData.has('1_0')) {
          sectionSel.value = '1';
          onSectionChange();
          tableSel.value = '1_0';
          onTableChange();
          onIndicatorChange();
        }
        var params = new URLSearchParams(window.location.search);
        var wantTable = params.get('table');
        var wantIndicator = params.get('indicator');
        if (wantTable && tablesWithData.has(wantTable)) {
          var tbl = tableList.filter(function (t) { return t.id === wantTable; })[0];
          if (tbl && sectionsWithData.has(tbl.section)) {
            sectionSel.value = String(tbl.section);
            onSectionChange();
            tableSel.value = wantTable;
            onTableChange();
            if (wantIndicator) {
              var opts = indSel.options;
              for (var j = 0; j < opts.length; j++) {
                if (opts[j].value === wantIndicator) { indSel.value = wantIndicator; break; }
              }
              onIndicatorChange();
            }
          }
        }
        var mt = document.getElementById('map-table');
        updateMapWithCountryData(mt && mt.value ? mt.value : MAP_TABLE_TEST);
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
