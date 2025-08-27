import { data, charts, colorsByDepartment, darkModeColors, globalChartOptions, hexToRGBA, formatMonthLabel, formatMonthShort, formatCurrencyBRL } from './main.js';

let pieChartState = {
    range: 6,
    offset: 0,
    selectedDepartments: [],
    chartInstances: [],
    previousState: null
};

export function initExpensesView() {
    pieChartState.selectedDepartments = [...data.departments];
    const last12Months = data.months.slice(-12);

    createTotalExpendituresChart(data.data, last12Months);
    createDepartmentTrendsChart(data.data, last12Months, data.departments);
    createAvgExpenditureChart(data.data, last12Months);
    createEmployeesChart(data.data, last12Months);
    createPercentageStackedChart(data.data, last12Months, data.departments);

    setupTimeFilters();
    setupDepartmentBreakdown();
}

function setupTimeFilters() {
    const totalExpWrapper = document.getElementById('total-expenditures-wrapper');
    const trendsWrapper = document.getElementById('department-trends-wrapper');
    
    const tryParseJSON = (jsonString) => {
        if (!jsonString || jsonString === 'undefined' || jsonString === 'null') return [];
        if (jsonString === 'all') return data.departments || [];
        try { return JSON.parse(jsonString); } catch (e) { return []; }
    };
    
    const filterGrid = totalExpWrapper.querySelector('.filter-grid');
    if (!filterGrid) {
        const container = totalExpWrapper.querySelector('.filter-buttons-wrapper');
        container.innerHTML = '<div class="filter-grid"></div>';
        const newGrid = container.querySelector('.filter-grid');
        const mainDepts = ["Operação", "Comercial", "Diretoria", "Marketing", "NEC"];
        const otherDepts = data.departments.filter(d => !mainDepts.includes(d));
        const allBtn = document.createElement('button');
        allBtn.className = 'filter-btn active';
        allBtn.dataset.department = 'all';
        allBtn.textContent = 'Todos';
        const row1 = document.createElement('div');
        row1.className = 'filter-row toggle-switch-group';
        row1.appendChild(allBtn);
        mainDepts.forEach(dept => {
            if (data.departments.includes(dept)) {
                const button = document.createElement('button');
                button.className = 'filter-btn';
                button.dataset.department = dept;
                button.textContent = dept;
                row1.appendChild(button);
            }
        });
        const row2 = document.createElement('div');
        row2.className = 'filter-row toggle-switch-group';
        otherDepts.forEach(dept => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.dataset.department = dept;
            button.textContent = dept;
            row2.appendChild(button);
        });
        newGrid.appendChild(row1);
        if (otherDepts.length > 0) newGrid.appendChild(row2);
    }

    totalExpWrapper.addEventListener('click', function(event) {
        if (!event.target.classList.contains('filter-btn')) return;

        const button = event.target;
        const isTimeFilter = button.closest('.time-filters');
        
        if (isTimeFilter) {
            totalExpWrapper.querySelectorAll('.time-filters .filter-btn').forEach(btn => btn.classList.remove('active'));
        } else if (button.closest('.filter-grid')) {
            totalExpWrapper.querySelectorAll('.filter-grid .filter-btn').forEach(btn => btn.classList.remove('active'));
        }
        button.classList.add('active');

        const activeMonths = totalExpWrapper.querySelector('.time-filters .filter-btn.active').dataset.months;
        const activeDept = totalExpWrapper.querySelector('.filter-grid .filter-btn.active').dataset.department;
        
        const chart = charts.totalExpenditures;
        const monthsToShow = data.months.slice(-activeMonths);
        chart.data.labels = monthsToShow.map(formatMonthShort);
        
        const isDarkMode = document.body.classList.contains('dark');
        const mainColor = isDarkMode ? darkModeColors.main : '#024B59';

        if (activeDept === 'all') {
            chart.data.datasets[0].label = 'Gastos Totais';
            chart.data.datasets[0].data = monthsToShow.map(month => data.data[month]?.total || 0);
            chart.data.datasets[0].borderColor = mainColor;
            chart.data.datasets[0].backgroundColor = hexToRGBA(mainColor, 0.1);
            chart.data.datasets[0].isMainLine = true;
        } else {
            const color = colorsByDepartment[activeDept] || '#cccccc';
            chart.data.datasets[0].label = `Gastos - ${activeDept}`;
            chart.data.datasets[0].data = monthsToShow.map(m => data.data[m]?.departments?.[activeDept]?.geral || 0);
            chart.data.datasets[0].borderColor = color;
            chart.data.datasets[0].backgroundColor = hexToRGBA(color, 0.12);
            chart.data.datasets[0].isMainLine = false;
        }
        chart.update();
    });

    if (trendsWrapper) {
        trendsWrapper.querySelectorAll('.toggle-switch-group .filter-btn').forEach(button => {
            button.addEventListener('click', function() {
                const parentGroup = this.closest('.toggle-switch-group');
                parentGroup.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                const monthsRange = trendsWrapper.querySelector('.time-filters .filter-btn.active')?.dataset.months || 'all';
                const monthsToShow = monthsRange === 'all' ? data.months : data.months.slice(-monthsRange);
                const selectedDepartments = tryParseJSON(trendsWrapper.querySelector('.filter-buttons .filter-btn.active')?.dataset.departments || 'all');
                
                const chart = charts.departmentTrends;
                chart.data.labels = monthsToShow.map(formatMonthShort);
                chart.data.datasets = selectedDepartments.map(dept => ({
                    label: dept, data: monthsToShow.map(month => data.data[month]?.departments[dept]?.geral || 0),
                    borderColor: colorsByDepartment[dept] || "#ccc", borderWidth: 2, fill: false, tension: 0.3
                }));
                chart.update();
            });
        });
    }
}

function createTotalExpendituresChart(chartData, months) {
    const canvas = document.getElementById('total-expenditures-chart');
    if (!canvas) return;
    const isDarkMode = document.body.classList.contains('dark');
    const mainColor = isDarkMode ? darkModeColors.main : '#024B59';

    charts.totalExpenditures = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Gastos Totais', data: months.map(month => chartData[month]?.total || 0),
                borderColor: mainColor, backgroundColor: hexToRGBA(mainColor, 0.1),
                borderWidth: 2, fill: true, tension: 0.4, isMainLine: true
            }]
        },
        options: { ...globalChartOptions, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) }, grace: '10%' } } }
    });
}

function createDepartmentTrendsChart(chartData, months, departments) {
    const ctx = document.getElementById('department-trends-chart');
    if (!ctx) return;
    charts.departmentTrends = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: departments.map(dept => ({
                label: dept, data: months.map(month => chartData[month]?.departments[dept]?.geral || 0),
                borderColor: colorsByDepartment[dept] || "#ccc", borderWidth: 2, fill: false, tension: 0.3
            }))
        },
        options: { ...globalChartOptions, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
}

function createAvgExpenditureChart(chartData, months) {
    const ctx = document.getElementById('avg-expenditure-chart');
    if (!ctx) return;
    const isDarkMode = document.body.classList.contains('dark');
    const mainColor = isDarkMode ? darkModeColors.main : '#024B59';
    charts.avgExpenditure = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Média de Gastos por Funcionário',
                data: months.map(month => (chartData[month]?.totalEmployees > 0) ? chartData[month].total / chartData[month].totalEmployees : 0),
                borderColor: mainColor, backgroundColor: hexToRGBA(mainColor, 0.1), borderWidth: 2, fill: true, tension: 0.4, isMainLine: true
            }]
        },
        options: { ...globalChartOptions, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Média: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) }, grace: '10%' } } }
    });
}

function createEmployeesChart(chartData, months) {
    const ctx = document.getElementById('employees-chart');
    if (!ctx) return;
    const isDarkMode = document.body.classList.contains('dark');
    const mainColor = isDarkMode ? darkModeColors.main : '#024B59';
    charts.employees = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Total de Funcionários', data: months.map(month => chartData[month]?.totalEmployees || 0),
                borderColor: mainColor, backgroundColor: hexToRGBA(mainColor, 0.1), borderWidth: 2, fill: true, tension: 0.4, isMainLine: true
            }]
        },
        options: { ...globalChartOptions, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Total: ${context.parsed.y}` } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

function createPercentageStackedChart(chartData, months, departments) {
    const ctx = document.getElementById('percentage-stacked-chart');
    if (!ctx) return;
    charts.percentageStacked = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: months.map(formatMonthShort),
            datasets: departments.map(dept => ({
                label: dept,
                data: months.map(month => {
                    const total = chartData[month]?.total || 1;
                    return (total > 0) ? ((chartData[month]?.departments[dept]?.geral || 0) / total) * 100 : 0;
                }),
                backgroundColor: colorsByDepartment[dept] || "#ccc"
            }))
        },
        options: { ...globalChartOptions, plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%` } } }, scales: { x: { stacked: true }, y: { stacked: true, max: 100, ticks: { callback: (value) => value + "%" } } } }
    });
}

function setupDepartmentBreakdown() {
    const wrapper = document.getElementById('department-breakdown-wrapper');
    if (!wrapper) return;
    
    wrapper.innerHTML = `
        <h2>Distribuição de Gastos por Departamento</h2>
        <div class="centered-toggle">
            <div class="time-filters toggle-switch-group">
                <button class="filter-btn pie-time-btn" data-months="1">1 Mês</button>
                <button class="filter-btn pie-time-btn" data-months="3">3 Meses</button>
                <button class="filter-btn pie-time-btn active" data-months="6">6 Meses</button>
                <button class="filter-btn pie-time-btn" data-months="12">12 Meses</button>
            </div>
        </div>
        <div class="pie-chart-main-content">
            <div class="pie-chart-area">
                <div id="department-breakdown-charts"></div>
                <div class="pie-chart-nav toggle-switch-group">
                </div>
            </div>
            <div class="department-legend-sidebar">
                <h4>Departamentos</h4>
                <div id="pie-department-filters"></div>
            </div>
        </div>
    `;

    const navContainer = wrapper.querySelector('.pie-chart-nav');
    const prevBtn = document.createElement('button');
    prevBtn.id = 'pie-nav-prev';
    prevBtn.className = 'filter-btn';
    prevBtn.innerHTML = '&lt;';
    navContainer.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.id = 'pie-nav-next';
    nextBtn.className = 'filter-btn';
    nextBtn.innerHTML = '&gt;';
    navContainer.appendChild(nextBtn);

    document.querySelectorAll('.pie-time-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.pie-time-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            pieChartState.range = parseInt(button.dataset.months);
            pieChartState.offset = 0;
            pieChartState.previousState = null;
            updateDepartmentBreakdownCharts();
        });
    });
    prevBtn.addEventListener('click', () => {
        pieChartState.offset += pieChartState.range;
        updateDepartmentBreakdownCharts();
    });
    nextBtn.addEventListener('click', () => {
        pieChartState.offset -= pieChartState.range;
        updateDepartmentBreakdownCharts();
    });
    updateDepartmentBreakdownCharts();
}

function updateDepartmentBreakdownCharts() {
    const container = document.getElementById('department-breakdown-charts');
    const filterContainer = document.getElementById('pie-department-filters');
    const navButtons = document.querySelector('.pie-chart-nav');
    const prevBtn = document.getElementById('pie-nav-prev');
    const nextBtn = document.getElementById('pie-nav-next');
    if (!container || !filterContainer) return;

    pieChartState.chartInstances.forEach(chart => chart.destroy());
    pieChartState.chartInstances = [];
    container.innerHTML = '';
    filterContainer.innerHTML = '';

    const totalMonths = data.months.length;
    const startIndex = Math.max(0, totalMonths - pieChartState.range - pieChartState.offset);
    const endIndex = totalMonths - pieChartState.offset;
    const monthsToShow = data.months.slice(startIndex, endIndex);

    navButtons.style.display = (pieChartState.range < 12 || pieChartState.previousState) ? 'flex' : 'none';
    
    nextBtn.disabled = pieChartState.offset <= 0;
    prevBtn.disabled = startIndex <= 0;
    
    const allButton = document.createElement('button');
    allButton.className = 'filter-btn' + (pieChartState.selectedDepartments.length === data.departments.length ? ' active' : '');
    allButton.textContent = 'Todos';
    allButton.onclick = () => {
        pieChartState.selectedDepartments = pieChartState.selectedDepartments.length === data.departments.length ? [] : data.departments.slice();
        updateDepartmentBreakdownCharts();
    };
    filterContainer.appendChild(allButton);

    data.departments.forEach(dept => {
        const item = document.createElement('div');
        const isActive = pieChartState.selectedDepartments.includes(dept);
        item.className = 'department-legend-item' + (isActive ? '' : ' inactive');
        item.innerHTML = `<div class="department-legend-swatch" style="background-color: ${colorsByDepartment[dept] || '#ccc'};"></div><span>${dept}</span>`;
        item.onclick = () => {
            const index = pieChartState.selectedDepartments.indexOf(dept);
            if (index > -1) pieChartState.selectedDepartments.splice(index, 1);
            else pieChartState.selectedDepartments.push(dept);
            updateDepartmentBreakdownCharts();
        };
        filterContainer.appendChild(item);
    });

    if (monthsToShow.length === 0) {
        container.innerHTML = '<p>Não há dados para o período selecionado.</p>';
        return;
    }

    container.dataset.range = pieChartState.range;

    monthsToShow.forEach((month, index) => {
        const monthData = data.data[month];
        if (!monthData) return;

        const pieItem = document.createElement('div');
        pieItem.className = 'pie-item';
        pieItem.style.animationDelay = `${index * 100}ms`;
        
        const canvas = document.createElement('canvas');
        const label = document.createElement('div');
        label.className = 'pie-label';
        label.textContent = formatMonthLabel(month);
        
        if (pieChartState.range === 1) {
            pieItem.classList.add('single-view');
            const customLegend = document.createElement('div');
            customLegend.className = 'custom-legend-container';
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'pie-chart-wrapper';
            chartWrapper.appendChild(canvas);
            chartWrapper.appendChild(label);
            
            pieItem.appendChild(customLegend);
            pieItem.appendChild(chartWrapper);
        } else {
            pieItem.appendChild(canvas);
            pieItem.appendChild(label);
        }

        container.appendChild(pieItem);
        pieItem.onclick = () => handlePieClick(month);

        const filteredDeptData = pieChartState.selectedDepartments
            .map(dept => ({ name: dept, value: monthData.departments[dept]?.geral || 0 }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);
        
        const chart = new Chart(canvas, {
            type: 'pie',
            data: {
                labels: filteredDeptData.map(d => d.name),
                datasets: [{
                    data: filteredDeptData.map(d => d.value),
                    backgroundColor: filteredDeptData.map(d => colorsByDepartment[d.name] || "#ccc"),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: {
                    duration: 800,
                    easing: 'easeOutQuart',
                    animateScale: true
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? (value / total * 100).toFixed(2) : 0;
                                return `${label}: ${formatCurrencyBRL(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        if (pieChartState.range === 1) {
            renderCustomLegend(pieItem.querySelector('.custom-legend-container'), filteredDeptData);
        }

        pieChartState.chartInstances.push(chart);
    });
}

function handlePieClick(month) {
    if (pieChartState.previousState) {
        pieChartState.range = pieChartState.previousState.range;
        pieChartState.offset = pieChartState.previousState.offset;
        pieChartState.previousState = null;
    } 
    else if (pieChartState.range > 1) {
        pieChartState.previousState = { range: pieChartState.range, offset: pieChartState.offset };
        const monthIndex = data.months.indexOf(month);
        pieChartState.range = 1;
        pieChartState.offset = data.months.length - 1 - monthIndex;
    }
    updateDepartmentBreakdownCharts();
}

function renderCustomLegend(container, chartData) {
    if (!container) return;
    container.innerHTML = '';
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    
    const column = document.createElement('div');
    column.className = 'legend-column';

    chartData.forEach((item) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="legend-swatch" style="background-color: ${colorsByDepartment[item.name] || '#ccc'}"></div>
            <div class="legend-name">${item.name}</div>
            <div class="legend-percent">${((item.value / total) * 100).toFixed(2)}%</div>
        `;
        column.appendChild(legendItem);
    });
    container.appendChild(column);
}
 
