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

  function updateChart(labels, values, indicatorName) {
    var ctx = document.getElementById('chart').getContext('2d');
    var isVerticalLabels = labels.length > 20;
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].label = indicatorName;
      if (chart.options.plugins.datalabels) {
        chart.options.plugins.datalabels.rotation = isVerticalLabels ? -90 : 0;
      }
      chart.update('none');
      return;
    }
    var plugins = [];
    if (typeof ChartDataLabels !== 'undefined') plugins.push(ChartDataLabels);
    chart = new Chart(ctx, {
      type: 'bar',
      plugins: plugins,
      data: {
        labels: labels,
        datasets: [{
          label: indicatorName,
          data: values,
          backgroundColor: 'rgba(37, 99, 235, 0.5)',
          borderColor: 'rgba(37, 99, 235, 0.85)',
          borderWidth: 1
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
            align: 'top',
            rotation: isVerticalLabels ? -90 : 0,
            color: '#4a5568',
            font: { family: 'JetBrains Mono, monospace', size: 10 },
            formatter: function (v) { return typeof v === 'number' && !isNaN(v) ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) : ''; }
          } : undefined
        },
        scales: {
          x: {
            grid: { color: 'rgba(0, 0, 0, 0.08)' },
            ticks: { color: '#4a5568', maxRotation: isVerticalLabels ? 90 : 45 },
            title: { display: true, text: 'Year (financial year start)', color: '#4a5568' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0, 0, 0, 0.08)' },
            ticks: { color: '#4a5568' },
            title: { display: true, text: 'Value', color: '#4a5568' }
          }
        }
      }
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
