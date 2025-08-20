import { data, colorsByDepartment, globalChartOptions, hexToRGBA, formatMonthShort, formatCurrencyBRL } from './main.js';

export function initEarningsView() {
    // This function is now responsible for finding its own elements.
    const viewContainer = document.getElementById('earnings-view');
    if (!viewContainer) {
        console.error("Earnings view container not found!");
        return;
    }

    const last12Months = data.months.slice(-12);

    // Create charts
    createEarningsVsCostsChart(data.data, last12Months);
    createNetProfitLossChart(data.data, last12Months);
    createProfitMarginChart(data.data, last12Months);
    createEarningsAllocationChart(data.data, last12Months, data.departments);
    createEarningsPerEmployeeChart(data.data, last12Months);
}

function createEarningsVsCostsChart(chartData, months) {
    const ctx = document.getElementById('earnings-vs-costs-chart');
    if (!ctx) return null;
    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [
                { label: 'Faturamento', data: months.map(m => chartData[m]?.earnings || 0), borderColor: '#024B59', tension: 0.4, borderWidth: 2, fill: true, backgroundColor: hexToRGBA('#024B59', 0.1) },
                { label: 'Gastos com Pessoal', data: months.map(m => chartData[m]?.total || 0), borderColor: '#E44D42', tension: 0.4, borderWidth: 2, fill: true, backgroundColor: hexToRGBA('#E44D42', 0.1) }
            ]
        },
        options: { ...globalChartOptions, animation: { y: { from: 500 } }, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
}

function createNetProfitLossChart(chartData, months) {
    const ctx = document.getElementById('net-profit-loss-chart');
    if (!ctx) return null;
    new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Diferença',
                data: months.map(m => (chartData[m]?.earnings || 0) - (chartData[m]?.total || 0)),
                backgroundColor: months.map(m => ((chartData[m]?.earnings || 0) - (chartData[m]?.total || 0)) >= 0 ? '#024B59' : '#E44D42')
            }]
        },
        options: { ...globalChartOptions, animation: { y: { from: 500 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Diferença: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
}

function createProfitMarginChart(chartData, months) {
    const ctx = document.getElementById('profit-margin-chart');
    if (!ctx) return null;
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
    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Margem', data: profitMargins,
                borderColor: '#024B59', backgroundColor: 'rgba(2, 75, 89, 0.1)',
                tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: '#024B59', pointHoverRadius: 7,
                clip: false
            }]
        },
        plugins: [percentageChangeBubbles],
        options: {
            ...globalChartOptions,
            animation: { y: { from: 500 } },
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
    
    const chart = new Chart(ctx, {
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
            chart.data.datasets.forEach(dataset => {
                dataset.data = newData[dataset.label];
            });
            chart.update();
        });
    });
}


function createEarningsPerEmployeeChart(chartData, months) {
    const container = document.getElementById('earnings-per-employee-card');
    const canvas = document.getElementById('earnings-per-employee-chart');
    if (!container || !canvas) return;
    
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
    const chart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Faturamento por Funcionário', data: months.map(m => getChartData(m, 'company')),
                borderColor: '#024B59', backgroundColor: 'rgba(2, 75, 89, 0.1)',
                tension: 0.4, fill: true, borderWidth: 2
            }]
        },
        options: {
            ...globalChartOptions,
            animation: { y: { from: 500 } },
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
            chart.data.datasets[0].data = months.map(m => getChartData(m, mode));
            chart.update();
        });
    });
}
