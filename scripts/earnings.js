import { data, colorsByDepartment, globalChartOptions, hexToRGBA, formatMonthShort, formatCurrencyBRL } from './main.js';

// --- Helper to setup info tooltips ---
function setupInfoTooltips() {
    const tooltips = {
        'earnings-vs-costs-card-wrapper': `
            <p>Este gráfico compara o <strong>Faturamento</strong> (quanto a empresa ganhou) com os <strong>Gastos com Pessoal</strong> (quanto foi gasto com salários e benefícios).</p>
            <p>Linhas que se afastam indicam maior lucratividade, enquanto linhas que se aproximam podem sinalizar uma redução na margem.</p>
        `,
        'net-profit-loss-card-wrapper': `
            <p>Mostra o resultado final de cada mês: <strong>Faturamento - Gastos com Pessoal</strong>.</p>
            <p>Barras acima de zero representam um superávit (sobra de dinheiro), enquanto barras abaixo de zero indicam um déficit (falta de dinheiro).</p>
        `,
        'profit-margin-card-wrapper': `
            <p>Mede a <strong>eficiência operacional</strong>. A linha representa qual porcentagem do faturamento foi usada para cobrir os gastos com pessoal.</p>
            <p>Uma linha descendente indica melhora na eficiência, enquanto uma ascendente sugere que os custos estão crescendo mais rápido que as receitas.</p>
        `,
        'earnings-allocation-card': `
            <p>Este gráfico distribui o faturamento total entre os departamentos. A alocação pode ser baseada no <strong>número de funcionários (Headcount)</strong> ou no <strong>custo total (Custos)</strong> de cada departamento, mostrando para onde o dinheiro 'simbolicamente' vai.</p>
        `,
        'earnings-per-employee-card': `
            <p>Calcula a média de faturamento gerado por cada funcionário. É um indicador de <strong>produtividade</strong>.</p>
            <p>Uma linha ascendente sugere que a empresa está gerando mais receita por pessoa, o que é um sinal de otimização.</p>
        `
    };

    for (const [cardId, content] of Object.entries(tooltips)) {
        const card = document.getElementById(cardId);
        if (card) {
            const tooltipElement = card.querySelector('.info-tooltip');
            if (tooltipElement) {
                tooltipElement.innerHTML = content;
            }
        }
    }
}


export function initEarningsView() {
    const last12Months = data.months.slice(-12);

    // Create charts
    createEarningsVsCostsChart(data.data, last12Months);
    createNetProfitLossChart(data.data, last12Months);
    createProfitMarginChart(data.data, last12Months);
    createEarningsAllocationChart(data.data, last12Months, data.departments);
    createEarningsPerEmployeeChart(data.data, last12Months);
    
    // Initialize tooltips
    setupInfoTooltips();
}

function createEarningsVsCostsChart(chartData, months) {
    const ctx = document.getElementById('earnings-vs-costs-chart');
    if (!ctx) return;

    // --- Helper function to draw styled bubbles ---
    const drawBubble = (chartCtx, text, x, y, isNegative) => {
        chartCtx.save();
        chartCtx.fillStyle = isNegative ? 'rgba(220, 53, 69, 0.85)' : 'rgba(25, 135, 84, 0.85)';
        chartCtx.strokeStyle = isNegative ? '#dc3545' : '#198754';
        chartCtx.lineWidth = 1;
        chartCtx.font = 'bold 12px "Plus Jakarta Sans"';

        const textMetrics = chartCtx.measureText(text);
        const bubbleWidth = textMetrics.width + 16;
        const bubbleHeight = 24;
        const borderRadius = 12;

        chartCtx.beginPath();
        chartCtx.moveTo(x - bubbleWidth / 2 + borderRadius, y - bubbleHeight / 2);
        chartCtx.lineTo(x + bubbleWidth / 2 - borderRadius, y - bubbleHeight / 2);
        chartCtx.quadraticCurveTo(x + bubbleWidth / 2, y - bubbleHeight / 2, x + bubbleWidth / 2, y - bubbleHeight / 2 + borderRadius);
        chartCtx.lineTo(x + bubbleWidth / 2, y + bubbleHeight / 2 - borderRadius);
        chartCtx.quadraticCurveTo(x + bubbleWidth / 2, y + bubbleHeight / 2, x + bubbleWidth / 2 - borderRadius, y + bubbleHeight / 2);
        chartCtx.lineTo(x - bubbleWidth / 2 + borderRadius, y + bubbleHeight / 2);
        chartCtx.quadraticCurveTo(x - bubbleWidth / 2, y + bubbleHeight / 2, x - bubbleWidth / 2, y + bubbleHeight / 2 - borderRadius);
        chartCtx.lineTo(x - bubbleWidth / 2, y - bubbleHeight / 2 + borderRadius);
        chartCtx.quadraticCurveTo(x - bubbleWidth / 2, y - bubbleHeight / 2, x - bubbleWidth / 2 + borderRadius, y - bubbleHeight / 2);
        chartCtx.closePath();
        chartCtx.fill();
        chartCtx.stroke();

        chartCtx.fillStyle = '#fff';
        chartCtx.textAlign = 'center';
        chartCtx.textBaseline = 'middle';
        chartCtx.fillText(text, x, y);
        chartCtx.restore();
    };

    // --- Generic Bubble Plugin ---
    const createBubblePlugin = (id, logic) => ({
        id,
        afterDatasetsDraw(chart) {
            if (!chart.options.plugins[id] || !chart.options.plugins[id].show) return;

            const { ctx, data, _metasets } = chart;
            const targetDatasetIndex = chart.options.plugins[id].targetDatasetIndex;
            
            if (chart.isDatasetVisible(targetDatasetIndex)) {
                const meta = _metasets.find(m => m.index === targetDatasetIndex);
                if (meta) {
                    logic(chart, ctx, data, meta);
                }
            }
        }
    });

    // --- Plugin Logic ---
    const varianceLogic = (chart, ctx, data, meta) => {
        const points = meta.data;
        const costsData = data.datasets[meta.index].data;
        for (let i = 1; i < points.length; i++) {
            const currentCost = costsData[i];
            const prevCost = costsData[i - 1];
            if (prevCost === 0 || isNaN(currentCost) || isNaN(prevCost)) continue;
            const change = ((currentCost - prevCost) / prevCost) * 100;
            const text = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
            const isNegativeEvent = change >= 0;
            drawBubble(ctx, text, points[i].x, points[i].y - 22, isNegativeEvent);
        }
    };

    const efficiencyLogic = (chart, ctx, data, meta) => {
        const points = meta.data;
        const costsData = data.datasets[meta.index].data;
        const earningsData = data.datasets[0].data;
        for (let i = 0; i < points.length; i++) {
            const cost = costsData[i];
            const earning = earningsData[i];
            if (earning === 0 || isNaN(cost) || isNaN(earning)) continue;
            const ratio = (cost / earning) * 100;
            const text = `${ratio.toFixed(1)}%`;
            const isNegativeEvent = ratio > 50;
            drawBubble(ctx, text, points[i].x, points[i].y - 22, isNegativeEvent);
        }
    };

    const costVariancePlugin = createBubblePlugin('costVarianceBubbles', varianceLogic);
    const costEfficiencyPlugin = createBubblePlugin('costEfficiencyBubbles', efficiencyLogic);

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [
                { label: 'Faturamento', data: months.map(m => chartData[m]?.earnings || 0), borderColor: '#024B59', tension: 0.4, borderWidth: 2, fill: true, backgroundColor: hexToRGBA('#024B59', 0.1), pointRadius: 4, pointHoverRadius: 6, clip: false },
                { label: 'Gastos com Pessoal (Geral)', data: months.map(m => chartData[m]?.total || 0), borderColor: '#E44D42', tension: 0.4, borderWidth: 2, fill: true, backgroundColor: hexToRGBA('#E44D42', 0.1), pointRadius: 4, pointHoverRadius: 6, clip: false },
                { label: 'Gastos com Pessoal (Operação)', data: months.map(m => chartData[m]?.departments?.['Operação']?.geral || 0), borderColor: '#FFA500', tension: 0.4, borderWidth: 2, fill: true, backgroundColor: hexToRGBA('#FFA500', 0.1), pointRadius: 4, pointHoverRadius: 6, clip: false, hidden: true }
            ]
        },
        plugins: [costVariancePlugin, costEfficiencyPlugin],
        options: { 
            ...globalChartOptions,
            layout: { padding: { top: 35, bottom: 10, right: 40 } },
            animation: { y: { from: 500 } }, 
            plugins: { 
                legend: { position: 'top' }, 
                tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrencyBRL(context.parsed.y)}` } },
                costVarianceBubbles: { show: false, targetDatasetIndex: 1 },
                costEfficiencyBubbles: { show: false, targetDatasetIndex: 1 }
            }, 
            scales: { 
                y: { grace: '10%', ticks: { callback: (value) => formatCurrencyBRL(value) } } 
            } 
        }
    });

    // --- Event Listeners for Toggles ---
    const costModeButtons = document.querySelectorAll('[data-cost-mode]');
    const varianceBtn = document.getElementById('toggle-cost-variance');
    const efficiencyBtn = document.getElementById('toggle-cost-efficiency');

    const setBubbleVisibility = (shouldShow) => {
        varianceBtn.disabled = !shouldShow;
        efficiencyBtn.disabled = !shouldShow;
        if (!shouldShow) {
            varianceBtn.classList.remove('active');
            efficiencyBtn.classList.remove('active');
            chart.options.plugins.costVarianceBubbles.show = false;
            chart.options.plugins.costEfficiencyBubbles.show = false;
        }
    };

    costModeButtons.forEach(button => {
        button.addEventListener('click', () => {
            costModeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const mode = button.dataset.costMode;

            if (mode === 'total') {
                chart.setDatasetVisibility(1, true);
                chart.setDatasetVisibility(2, false);
                setBubbleVisibility(true);
                chart.options.plugins.costVarianceBubbles.targetDatasetIndex = 1;
                chart.options.plugins.costEfficiencyBubbles.targetDatasetIndex = 1;
            } else if (mode === 'operations') {
                chart.setDatasetVisibility(1, false);
                chart.setDatasetVisibility(2, true);
                setBubbleVisibility(true);
                chart.options.plugins.costVarianceBubbles.targetDatasetIndex = 2;
                chart.options.plugins.costEfficiencyBubbles.targetDatasetIndex = 2;
            } else if (mode === 'both') {
                chart.setDatasetVisibility(1, true);
                chart.setDatasetVisibility(2, true);
                setBubbleVisibility(false);
            }
            chart.update();
        });
    });

    if (varianceBtn) {
        varianceBtn.addEventListener('click', () => {
            const isActive = varianceBtn.classList.toggle('active');
            chart.options.plugins.costVarianceBubbles.show = isActive;
            if (isActive && efficiencyBtn && efficiencyBtn.classList.contains('active')) {
                efficiencyBtn.classList.remove('active');
                chart.options.plugins.costEfficiencyBubbles.show = false;
            }
            chart.update();
        });
    }

    if (efficiencyBtn) {
        efficiencyBtn.addEventListener('click', () => {
            const isActive = efficiencyBtn.classList.toggle('active');
            chart.options.plugins.costEfficiencyBubbles.show = isActive;
            if (isActive && varianceBtn && varianceBtn.classList.contains('active')) {
                varianceBtn.classList.remove('active');
                chart.options.plugins.costVarianceBubbles.show = false;
            }
            chart.update();
        });
    }
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
                
                // An increase in the expense ratio is a NEGATIVE event.
                const isNegativeEvent = change >= 0;
                
                const x = points[i].x;
                const yOffset = (points[i].y < points[i-1].y) ? -25 : 25;
                const y = points[i].y + yOffset;
                
                ctx.fillStyle = isNegativeEvent ? 'rgba(220, 53, 69, 0.85)' : 'rgba(25, 135, 84, 0.85)'; // red : green
                ctx.strokeStyle = isNegativeEvent ? '#dc3545' : '#198754';
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
    
    // Calculate Expense Ratio (Cost / Earnings)
    const expenseRatios = months.map(m => {
        const monthInfo = chartData[m];
        if (!monthInfo) return 0;
        const earnings = monthInfo.earnings || 0;
        const total = monthInfo.total || 0;
        return earnings > 0 ? (total / earnings) * 100 : 0;
    });

    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Custo/Faturamento', data: expenseRatios,
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
            plugins: { 
                legend: { display: false }, 
                tooltip: { callbacks: { label: (context) => `Custo/Faturamento: ${context.parsed.y.toFixed(2)}%` } } 
            },
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
