(function () {
  'use strict';

  var base = (function () {
    var href = window.location.href;
    var last = href.lastIndexOf('/');
    return last >= 0 ? href.slice(0, last + 1) : '';
  })();
  var TABLES_URL = base + 'data/tables.json';
  var DATA_URL = base + 'data/indicators.csv';
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
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length >= 4) {
        rows.push({
          indicator: values[0],
          year: parseInt(values[1], 10),
          value: parseFloat(values[2]),
          table: values[3] || ''
        });
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
    var sectionId = sectionSel.value ? parseInt(sectionSel.value, 10) : null;
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

  function onTableChange() {
    var tableSel = document.getElementById('table');
    var indSel = document.getElementById('indicator');
    var tableId = tableSel.value;
    if (!tableId) {
      indSel.disabled = true;
      indSel.innerHTML = '<option value="">— Select a table first —</option>';
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update('none');
      }
      return;
    }
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
    filtered.sort(function (a, b) { return a.year - b.year; });
    const labels = filtered.map(function (r) { return r.year; }).filter(function (y) { return isFinite(y); });
    const values = filtered.map(function (r) { return r.value; });
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
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 0.9)',
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
            color: '#e4e7eb',
            font: { family: 'JetBrains Mono, monospace', size: 10 },
            formatter: function (v) { return typeof v === 'number' && !isNaN(v) ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) : ''; }
          } : undefined
        },
        scales: {
          x: {
            grid: { color: 'rgba(42, 48, 56, 0.6)' },
            ticks: { color: '#8b929a', maxRotation: isVerticalLabels ? 90 : 45 },
            title: { display: true, text: 'Year (financial year start)', color: '#8b929a' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(42, 48, 56, 0.6)' },
            ticks: { color: '#8b929a' },
            title: { display: true, text: 'Value', color: '#8b929a' }
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
      })
    ]).then(function (results) {
      try {
        tableList = results[0];
        if (!Array.isArray(tableList)) throw new Error('Invalid tables.json');
        allData = parseCSV(results[1]);
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
