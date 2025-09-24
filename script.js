(function() {
	'use strict';

	const els = {
		dateFrom: document.getElementById('date-from'),
		dateTo: document.getElementById('date-to'),
		department: document.getElementById('department-filter'),
		type: document.getElementById('appeal-type'),
		apply: document.getElementById('apply-filters'),
		reset: document.getElementById('reset-filters'),
		total: document.getElementById('total-appeals'),
		electronic: document.getElementById('electronic-appeals'),
		written: document.getElementById('written-appeals'),
		period: document.getElementById('period-appeals'),
		tableBody: document.getElementById('table-body'),
		search: document.getElementById('table-search'),
		exportBtn: document.getElementById('export-csv'),
		loading: document.getElementById('loading'),
		deptChartCanvas: document.getElementById('department-chart'),
		timeChartCanvas: document.getElementById('timeline-chart')
	};

	let rawData = null; 
	let fullRecords = []; 
	let deptChart = null;
	let timelineChart = null;

	function showLoading(show) {
		if (!els.loading) return;
		if (show) els.loading.classList.add('show'); else els.loading.classList.remove('show');
	}

	function buildQuery() {
		const p = new URLSearchParams();
		if (els.dateFrom.value) p.append('from', els.dateFrom.value);
		if (els.dateTo.value) p.append('to', els.dateTo.value);
		if (els.department.value) p.append('department', els.department.value);
		if (els.type.value) p.append('type', els.type.value === '' ? '' : (els.type.value === 'electronic' ? 'electronic' : 'written'));
		return p.toString();
	}

	async function loadData() {
		try {
			showLoading(true);
			const q = buildQuery();
			const url = '/statistics/data' + (q ? ('?' + q) : '');
			const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
			if (!resp.ok) throw new Error('HTTP ' + resp.status);
			const data = await resp.json();
			rawData = data;
			fullRecords = data.records || [];
			updateSummary();
			renderDepartmentTable();
			renderCharts();
		} catch (e) {
			console.error('Load error', e);
		} finally {
			showLoading(false);
		}
	}

	function updateSummary() {
		if (!rawData) return;
		const { summary } = rawData;
		if (els.total) els.total.textContent = summary.total;
		if (els.electronic) els.electronic.textContent = summary.electronic;
		if (els.written) els.written.textContent = summary.written;

		if (els.period) {
			if (els.dateFrom.value || els.dateTo.value) {
				els.period.textContent = summary.total;
			} else {
				els.period.textContent = '-';
			}
		}
	}

	function renderDepartmentTable() {
		if (!rawData || !els.tableBody) return;
		const searchTerm = (els.search.value || '').toLowerCase();
		const departments = rawData.departments || [];
		const total = rawData.summary.total || 0;
		els.tableBody.innerHTML = '';

		departments
			.filter(d => !searchTerm || d.department.toLowerCase().includes(searchTerm))
			.sort((a,b) => b.total - a.total)
			.forEach(dep => {
				const tr = document.createElement('tr');
				const percent = total ? (dep.total / total * 100).toFixed(2) : '0.00';
				tr.innerHTML = `
					<td>${dep.department}</td>
					<td>${dep.electronic}</td>
					<td>${dep.written}</td>
					<td>${dep.total}</td>
					<td>${dep.total}</td>
					<td>${percent}%</td>`;
				els.tableBody.appendChild(tr);
			});

		if (!departments.length) {
			const tr = document.createElement('tr');
			tr.innerHTML = '<td colspan="6" class="no-data">Немає даних</td>';
			els.tableBody.appendChild(tr);
		}
	}

	function renderCharts() {
		if (!rawData) return;
		const departments = rawData.departments || [];
		const timeline = rawData.timeline || [];

		if (els.deptChartCanvas) {
			const labels = departments.map(d => d.department);
			const totals = departments.map(d => d.total);
			if (deptChart) deptChart.destroy();
			deptChart = new Chart(els.deptChartCanvas.getContext('2d'), {
				type: 'bar',
				data: {
					labels,
					datasets: [{
						label: 'Всього звернень',
						data: totals,
						backgroundColor: '#667eea'
					}]
				},
				options: {
					responsive: true,
					plugins: { legend: { display: false } },
					scales: { x: { ticks: { autoSkip: false, maxRotation: 60, minRotation: 0 } } }
				}
			});
		}

		if (els.timeChartCanvas) {
			const labels = timeline.map(t => t.date).sort();
			const electronic = [];
			const written = [];
			const byDate = {};
			timeline.forEach(t => { byDate[t.date] = t; });
			labels.forEach(d => {
				electronic.push(byDate[d]?.electronic || 0);
				written.push(byDate[d]?.written || 0);
			});
			if (timelineChart) timelineChart.destroy();
			timelineChart = new Chart(els.timeChartCanvas.getContext('2d'), {
				type: 'line',
				data: {
					labels,
					datasets: [
						{ label: 'Електронні', data: electronic, borderColor: '#4c51bf', backgroundColor: 'rgba(76,81,191,0.2)', tension: 0.2 },
						{ label: 'Письмові', data: written, borderColor: '#a0aec0', backgroundColor: 'rgba(160,174,192,0.2)', tension: 0.2 }
					]
				},
				options: { responsive: true, interaction: { mode: 'index', intersect: false } }
			});
		}
	}

	function exportCSV() {
		if (!rawData) return;
		const rows = [['Department Key','Department','Type','Date']];
		fullRecords.forEach(r => {
			rows.push([r.department_key, r.department, r.type, r.date]);
		});
		let csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = 'statistics.csv';
		document.body.appendChild(a); a.click(); document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function resetFilters() {
		els.dateFrom.value = '';
		els.dateTo.value = '';
		els.department.value = '';
		els.type.value = '';
		loadData();
	}

	if (els.apply) els.apply.addEventListener('click', () => loadData());
	if (els.reset) els.reset.addEventListener('click', resetFilters);
	if (els.search) els.search.addEventListener('input', () => renderDepartmentTable());
	if (els.exportBtn) els.exportBtn.addEventListener('click', exportCSV);

	loadData();
})();
