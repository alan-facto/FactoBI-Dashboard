import { data, charts, colorsByDepartment, darkModeColors, globalChartOptions, hexToRGBA, formatMonthShort, formatCurrencyBRL } from './main.js';

export function initEarningsView() {
    const last12Months = data.months.slice(-12);

    createEarningsVsCostsChart(data.data, last12Months);
    createNetProfitLossChart(data.data, last12Months);
    createProfitMarginChart(data.data, last12Months);
    createEarningsAllocationChart(data.data, last12Months, data.departments);
    createEarningsPerEmployeeChart(data.data, last12Months);
}

function createEarningsVsCostsChart(chartData, months) {
    const ctx = document.getElementById('earnings-vs-costs-chart');
    if (!ctx) return;
    const isDarkMode = document.body.classList.contains('dark');
    const mainColor = isDarkMode ? darkModeColors.main : '#024B59';

    charts.earningsVsCosts = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [
                { label: 'Faturamento', data: months.map(m => chartData[m]?.earnings || 0), borderColor: mainColor, tension: 0.4, borderWidth: 2, fill: true, backgroundColor: hexToRGBA(mainColor, 0.1), isMainLine: true },
                { label: 'Gastos com Pessoal', data: months.map(m => chartData[m]?.total || 0), borderColor: '#E44D42', tension: 0.4, borderWidth: 2, fill: true, backgroundColor: hexToRGBA('#E44D42', 0.1) }
            ]
        },
        options: { ...globalChartOptions, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
}

function createNetProfitLossChart(chartData, months) {
    const ctx = document.getElementById('net-profit-loss-chart');
    if (!ctx) return;
    const isDarkMode = document.body.classList.contains('dark');
    const mainColor = isDarkMode ? darkModeColors.main : '#024B59';

    charts.netProfitLoss = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Diferença',
                data: months.map(m => (chartData[m]?.earnings || 0) - (chartData[m]?.total || 0)),
                backgroundColor: months.map(m => ((chartData[m]?.earnings || 0) - (chartData[m]?.total || 0)) >= 0 ? mainColor : '#E44D42'),
                isNetProfit: true
            }]
        },
        options: { ...globalChartOptions, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Diferença: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
}

function createProfitMarginChart(chartData, months) {
    const ctx = document.getElementById('profit-margin-chart');
    if (!ctx) return;
    const isDarkMode = document.body.classList.contains('dark');
    const mainColor = isDarkMode ? darkModeColors.main : '#024B59';

    const percentageChangeBubbles = {
        id: 'percentageChangeBubbles',
        afterDatasetsDraw(chart) {
            const { ctx, data, _metasets } = chart;
            const meta = _metasets[0];
            const points = meta.data;
            ctx.save();
            for (let i = 1; i < points.length; i++) {
                const currentPoint = data.datasets[0].data[i];
                const prevPoint = data.datasets[0].data[i - 1];
                const change = currentPoint - prevPoint;
                if (isNaN(change)) continue;
                const text = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
                const isPositive = change >= 0;
                const x = points[i].x;
                const yOffset = (points[i].y < points[i-1].y) ? -25 : 25;
                const y = points[i].y + yOffset;
                ctx.fillStyle = isPositive ? 'rgba(25, 135, 84, 0.85)' : 'rgba(220, 53, 69, 0.85)';
                ctx.strokeStyle = isPositive ? '#198754' : '#dc3545';
                ctx.lineWidth = 1;
                ctx.font = 'bold 12px "Plus Jakarta Sans"';
                const textMetrics = ctx.measureText(text);
                const bubbleWidth = textMetrics.width + 16;
                const bubbleHeight = 24;
                const borderRadius = 12;
                ctx.beginPath();
                ctx.moveTo(x - bubbleWidth / 2 + borderRadius, y - bubbleHeight / 2);
                ctx.lineTo(x + bubbleWidth / 2 - borderRadius, y - bubbleHeight / 2);
                ctx.quadraticCurveTo(x + bubbleWidth / 2, y - bubbleHeight / 2, x + bubbleWidth / 2, y - bubbleHeight / 2 + borderRadius);
                ctx.lineTo(x + bubbleWidth / 2, y + bubbleHeight / 2 - borderRadius);
                ctx.quadraticCurveTo(x + bubbleWidth / 2, y + bubbleHeight / 2, x + bubbleWidth / 2 - borderRadius, y + bubbleHeight / 2);
                ctx.lineTo(x - bubbleWidth / 2 + borderRadius, y + bubbleHeight / 2);
                ctx.quadraticCurveTo(x - bubbleWidth / 2, y + bubbleHeight / 2, x - bubbleWidth / 2, y + bubbleHeight / 2 - borderRadius);
                ctx.lineTo(x - bubbleWidth / 2, y - bubbleHeight / 2 + borderRadius);
                ctx.quadraticCurveTo(x - bubbleWidth / 2, y - bubbleHeight / 2, x - bubbleWidth / 2 + borderRadius, y - bubbleHeight / 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, x, y);
            }
            ctx.restore();
        }
    };
    const profitMargins = months.map(m => {
        const monthInfo = chartData[m];
        if (!monthInfo) return 0;
        const earnings = monthInfo.earnings || 0;
        return earnings > 0 ? ((earnings - (monthInfo.total || 0)) / earnings) * 100 : 0;
    });
    charts.profitMargin = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Margem', data: profitMargins,
                borderColor: mainColor, backgroundColor: hexToRGBA(mainColor, 0.1),
                tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: mainColor, pointHoverRadius: 7,
                clip: false, isMainLine: true
            }]
        },
        plugins: [percentageChangeBubbles],
        options: {
            ...globalChartOptions,
            layout: { padding: { top: 30, bottom: 30, right: 40, left: 10 } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Margem: ${context.parsed.y.toFixed(2)}%` } } },
            scales: { y: { ticks: { callback: (value) => value.toFixed(0) + "%" }, grace: '10%' } }
        }
    });
}

function createEarningsAllocationChart(chartData, months, departments) {
    const ctx = document.getElementById('earnings-allocation-chart');
    if (!ctx) return;

    const calculateAllocation = (mode = 'headcount') => {
        const allocatedData = {};
        departments.forEach(dept => allocatedData[dept] = []);

        months.forEach(month => {
            const monthData = chartData[month];
            if (!monthData || !monthData.earnings) {
                departments.forEach(dept => allocatedData[dept].push(0));
                return;
            }

            const totalValue = Object.values(monthData.departments).reduce((sum, dept) => {
                return sum + (mode === 'headcount' ? (dept.count || 0) : (dept.geral || 0));
            }, 0);

            if (totalValue === 0) {
                departments.forEach(dept => allocatedData[dept].push(0));
                return;
            }

            departments.forEach(dept => {
                const deptData = monthData.departments[dept];
                if (deptData) {
                    const proportion = (mode === 'headcount' ? (deptData.count || 0) : (deptData.geral || 0)) / totalValue;
                    allocatedData[dept].push(monthData.earnings * proportion);
                } else {
                    allocatedData[dept].push(0);
                }
            });
        });
        return allocatedData;
    };

    const initialData = calculateAllocation('headcount');
    
    charts.earningsAllocation = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(formatMonthShort),
            datasets: departments.map(dept => ({
                label: dept,
                data: initialData[dept],
                backgroundColor: colorsByDepartment[dept] || '#ccc'
            }))
        },
        options: {
            ...globalChartOptions,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label || '';
                            const value = context.parsed.y;
                            let total = 0;
                            for (let i = 0; i < context.chart.data.datasets.length; i++) {
                                total += context.chart.data.datasets[i].data[context.dataIndex];
                            }
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${datasetLabel}: ${formatCurrencyBRL(value)} (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: { stacked: true, ticks: { callback: (value) => formatCurrencyBRL(value) } }
            }
        }
    });

    const toggleButtons = document.querySelectorAll('#earnings-allocation-card .toggle-switch-group .filter-btn');
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            toggleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const mode = button.dataset.mode;
            const newData = calculateAllocation(mode);
            charts.earningsAllocation.data.datasets.forEach(dataset => {
                dataset.data = newData[dataset.label];
            });
            charts.earningsAllocation.update();
        });
    });
}


function createEarningsPerEmployeeChart(chartData, months) {
    const container = document.getElementById('earnings-per-employee-card');
    const canvas = document.getElementById('earnings-per-employee-chart');
    if (!container || !canvas) return;
    const isDarkMode = document.body.classList.contains('dark');
    const mainColor = isDarkMode ? darkModeColors.main : '#024B59';
    
    const getChartData = (month, mode) => {
        const monthInfo = chartData[month];
        if (!monthInfo) return 0;
        const earnings = monthInfo.earnings || 0;
        if (mode === 'operation') {
            const opEmployees = monthInfo.departments?.Operação?.count || 0;
            return opEmployees > 0 ? earnings / opEmployees : 0;
        }
        const totalEmployees = monthInfo.totalEmployees || 0;
        return totalEmployees > 0 ? earnings / totalEmployees : 0;
    };
    charts.earningsPerEmployee = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Faturamento por Funcionário', data: months.map(m => getChartData(m, 'company')),
                borderColor: mainColor, backgroundColor: hexToRGBA(mainColor, 0.1),
                tension: 0.4, fill: true, borderWidth: 2, isMainLine: true
            }]
        },
        options: {
            ...globalChartOptions,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Valor: ${formatCurrencyBRL(context.parsed.y)}` } } },
            scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) }, grace: '10%' } }
        }
    });
    
    const toggleButtons = container.querySelectorAll('.filter-buttons .filter-btn');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            toggleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const mode = button.dataset.mode;
            charts.earningsPerEmployee.data.datasets[0].data = months.map(m => getChartData(m, mode));
            charts.earningsPerEmployee.update();
        });
    });
}
