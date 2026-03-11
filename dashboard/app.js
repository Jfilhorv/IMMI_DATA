(function () {
  'use strict';

  const TABLES_URL = 'data/tables.json';
  const DATA_URL = 'data/indicators.csv';
  let tableList = [];
  let allData = [];
  let chart = null;

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

  function onTableChange() {
    const tableSel = document.getElementById('table');
    const indSel = document.getElementById('indicator');
    const tableId = tableSel.value;
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
    const indicators = getIndicatorsForTable(tableId);
    indSel.disabled = false;
    indSel.innerHTML = '<option value="">— Select indicator —</option>' +
      indicators.map(function (ind) {
        return '<option value="' + escapeHtml(ind) + '">' + escapeHtml(ind) + '</option>';
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
    const ctx = document.getElementById('chart').getContext('2d');
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].label = indicatorName;
      chart.update('none');
      return;
    }
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: indicatorName,
          data: values,
          backgroundColor: 'rgba(0, 102, 204, 0.6)',
          borderColor: 'rgb(0, 102, 204)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'Year (financial year start)' } },
          y: { beginAtZero: true, title: { display: true, text: 'Value' } }
        }
      }
    });
  }

  function loadData() {
    const tableSel = document.getElementById('table');
    const indSel = document.getElementById('indicator');
    tableSel.innerHTML = '<option value="">— Loading —</option>';
    tableSel.classList.add('loading');

    Promise.all([
      fetch(TABLES_URL).then(function (r) { return r.json(); }),
      fetch(DATA_URL).then(function (r) { return r.text(); })
    ]).then(function (results) {
      tableList = results[0];
      allData = parseCSV(results[1]);
      const dataTablePattern = /^\d+_\d+$/;
      const tablesWithData = new Set();
      allData.forEach(function (row) {
        if (dataTablePattern.test(row.table || '')) tablesWithData.add(row.table);
      });
      tableSel.innerHTML = '<option value="">— Select table —</option>' +
        tableList.filter(function (t) { return tablesWithData.has(t.id); }).map(function (t) {
          return '<option value="' + escapeHtml(t.id) + '">' + escapeHtml(t.title) + '</option>';
        }).join('');
      tableSel.classList.remove('loading');
      tableSel.addEventListener('change', onTableChange);
      indSel.addEventListener('change', onIndicatorChange);
    }).catch(function (err) {
      tableSel.innerHTML = '<option value="">Error loading data</option>';
      tableSel.classList.remove('loading');
      tableSel.classList.add('error');
      console.error(err);
    });
  }

  loadData();
})();
