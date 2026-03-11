(function () {
  'use strict';

  const DATA_URL = 'data/indicators.csv';
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

  function loadData() {
    const sel = document.getElementById('indicator');
    sel.innerHTML = '<option value="">— Loading —</option>';
    sel.classList.add('loading');

    fetch(DATA_URL)
      .then(function (r) { return r.text(); })
      .then(function (text) {
        allData = parseCSV(text);
        if (!allData.length) {
          sel.innerHTML = '<option value="">No data</option>';
          sel.classList.remove('loading');
          return;
        }
        const keys = new Set();
        allData.forEach(function (row) {
          keys.add(row.table + '|' + row.indicator);
        });
        const options = Array.from(keys).sort();
        sel.innerHTML = '<option value="">— Select indicator —</option>' +
          options.map(function (k) {
            const parts = k.split('|');
            const table = parts[0];
            const ind = parts[1];
            const label = ind + (table ? ' (' + table + ')' : '');
            return '<option value="' + escapeHtml(k) + '">' + escapeHtml(label) + '</option>';
          }).join('');
        sel.classList.remove('loading');
        sel.addEventListener('change', onIndicatorChange);
        sel.dispatchEvent(new Event('change'));
      })
      .catch(function (err) {
        sel.innerHTML = '<option value="">Error loading data</option>';
        sel.classList.remove('loading');
        sel.classList.add('error');
        console.error(err);
      });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function onIndicatorChange() {
    const sel = document.getElementById('indicator');
    const val = sel.value;
    if (!val) {
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update('none');
      }
      return;
    }
    const [table, indicator] = val.split('|');
    const filtered = allData.filter(function (row) {
      return row.table === table && row.indicator === indicator;
    });
    filtered.sort(function (a, b) { return a.year - b.year; });
    const labels = filtered.map(function (r) { return r.year; });
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
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: 'Year (financial year start)' }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Value' }
          }
        }
      }
    });
  }

  loadData();
})();
