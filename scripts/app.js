// Import necessary functions from the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDuXzhFCIUICOV4xrf7uYl3hYPAQp6qhbs",
  authDomain: "financialdashboard-a60a6.firebaseapp.com",
  projectId: "financialdashboard-a60a6",
  storageBucket: "financialdashboard-a60a6.appspot.com",
  messagingSenderId: "876071686917",
  appId: "1:876071686917:web:4c1fc89d1fc21fdec49d6c",
  measurementId: "G-C8GQJJR945"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Global Variables ---
let data = { months: [], departments: [], data: {} };
let charts = {};
let pieChartState = {
    range: 6,
    offset: 0,
    selectedDepartments: [],
    chartInstances: [],
    previousState: null
};


// --- Mappings and Helpers ---
const deptMap = {
    "Administrativo Financeiro": "Administrativo", "Apoio": "Apoio", "Comercial": "Comercial",
    "Diretoria": "Diretoria", "Direção": "Diretoria",
    "Jurídico Externo": "Jurídico", "Marketing": "Marketing",
    "NEC": "NEC", "Operação Geral": "Operação", "RH / Departamento Pessoal": "RH",
    "Planejamento Estratégico": "Planejamento Estratégico"
};

function convertMonthToYYYYMM(monthStr) {
    if (!monthStr || typeof monthStr !== 'string') return null;
    const s = monthStr.trim();
    let match = s.match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
    match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}`;
    match = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (match) return `${match[2]}-${match[1].padStart(2, '0')}`;
    match = s.match(/(\w{3,})\.-(\d{2})$/i);
    if (match) {
        const monthAbbr = match[1].substring(0, 3).toLowerCase();
        const yearShort = match[2];
        const yearFull = parseInt(yearShort, 10) < 70 ? `20${yearShort}` : `19${yearShort}`;
        const monthMap = { "jan": "01", "fev": "02", "mar": "03", "abr": "04", "mai": "05", "jun": "06", "jul": "07", "ago": "08", "set": "09", "out": "10", "nov": "11", "dez": "12" };
        const monthNum = monthMap[monthAbbr];
        if (monthNum) return `${yearFull}-${monthNum}`;
    }
    console.warn('Unrecognized month format:', s);
    return null;
}


// --- Main Data Fetching and Processing ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [expendituresSnapshot, earningsSnapshot] = await Promise.all([
            getDocs(collection(db, "expenditures")),
            getDocs(collection(db, "earnings"))
        ]);

        const fetchedRows = expendituresSnapshot.docs.map(doc => doc.data());
        const earningsData = earningsSnapshot.docs.map(doc => doc.data());

        if (!fetchedRows.length && !earningsData.length) {
            throw new Error("No expenditure or earnings data found in Firestore.");
        }

        const monthsSet = new Set();
        const departmentsSet = new Set();
        const structuredData = {};

        [...fetchedRows, ...earningsData].forEach(row => {
            const monthKey = convertMonthToYYYYMM(row["Month"] || row["Mês"]);
            if (monthKey) monthsSet.add(monthKey);
        });

        monthsSet.forEach(month => {
            if (!structuredData[month]) {
                structuredData[month] = { departments: {}, total: 0, totalEmployees: 0, earnings: 0 };
            }
        });

        fetchedRows.forEach(row => {
            const monthKey = convertMonthToYYYYMM(row["Month"]);
            if (!monthKey || !structuredData[monthKey]) return;
            const rawDept = row["Department"];
            const dept = deptMap[rawDept] || rawDept;
            const total = parseFloat(String(row["Total"]).replace(',', '.')) || 0;
            const bonificacao = parseFloat(String(row["Bonificacao 20"]).replace(',', '.')) || 0;
            const valeAlimentacao = parseFloat(String(row["Vale Alimentação"]).replace(',', '.')) || 0;
            const count = parseInt(row["Employee Count"]) || 0;
            const geral = total + bonificacao;

            if (dept && dept.toLowerCase() !== "total geral") {
                departmentsSet.add(dept);
                if (!structuredData[monthKey].departments[dept]) {
                    structuredData[monthKey].departments[dept] = { total: 0, bonificacao: 0, valeAlimentacao: 0, count: 0, geral: 0 };
                }
                structuredData[monthKey].departments[dept].total += total;
                structuredData[monthKey].departments[dept].bonificacao += bonificacao;
                structuredData[monthKey].departments[dept].valeAlimentacao += valeAlimentacao;
                structuredData[monthKey].departments[dept].count += count;
                structuredData[monthKey].departments[dept].geral += geral;

                structuredData[monthKey].total += geral;
                structuredData[monthKey].totalEmployees += count;
            }
        });

        earningsData.forEach(row => {
            const monthKey = convertMonthToYYYYMM(row["Mês"]);
            const faturamentoStr = row["Faturamento"];
            if (monthKey && faturamentoStr && structuredData[monthKey]) {
                const faturamentoValue = typeof faturamentoStr === 'number' ? faturamentoStr : parseFloat(String(faturamentoStr).replace(/["R$\s.]/g, '').replace(',', '.')) || 0;
                structuredData[monthKey].earnings = faturamentoValue;
            }
        });

        data = {
            months: Array.from(monthsSet).sort(),
            departments: Array.from(departmentsSet).sort(),
            data: structuredData
        };

        initDashboard();

    } catch (error) {
        console.error("Error loading data from Firestore:", error);
        showError(`Falha ao carregar os dados: ${error.message}`);
    }
});

// --- Color Mappings ---
const colorsByDepartment = {
    "Administrativo": "#6B5B95", "Apoio": "#FF6F61", "Comercial": "#E44D42",
    "Diretoria": "#0072B5", "Jurídico": "#2E8B57", "Marketing": "#FFA500",
    "NEC": "#9370DB", "Operação": "#00A86B", "RH": "#FF69B4",
    "Planejamento Estratégico": "#D95F02"
};

// --- Utility Functions ---
function hexToRGBA(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatMonthLabel(monthStr) {
    if (!monthStr || !monthStr.includes('-')) return "Invalid Date";
    const [year, month] = monthStr.split("-");
    const monthsPt = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${monthsPt[parseInt(month) - 1]}/${year}`;
}

function formatMonthShort(monthStr) {
    if (!monthStr || !monthStr.includes('-')) return "";
    const [year, month] = monthStr.split("-");
    return `${month}/${year.slice(2)}`;
}

function formatCurrencyBRL(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVA(value, month) {
    if (month < '2025-01' && (value === 0 || value === null || value === undefined)) {
        return 'N/A';
    }
    return formatCurrencyBRL(value);
}

// --- UI Setup and Generation ---
function setupTableToggle() {
    const container = document.querySelector('.table-toggle-container');
    const buttons = container.querySelectorAll('.table-toggle-btn');
    const tables = {
        'btn-summary-month': 'table-summary-month', 'btn-summary-department': 'table-summary-department',
        'btn-detailed-month': 'table-detailed-month', 'btn-detailed-department': 'table-detailed-department',
        'btn-earnings-table': 'table-earnings'
    };
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tableId = tables[button.id];
            
            Object.values(tables).forEach(id => document.getElementById(id).style.display = 'none');
            const tableEl = document.getElementById(tableId);
            tableEl.style.display = 'block';
            tableEl.innerHTML = '';

            if (button.id === 'btn-summary-month') generateSummaryByMonth();
            if (button.id === 'btn-summary-department') generateSummaryByDepartment();
            if (button.id === 'btn-detailed-month') generateDetailedByMonth();
            if (button.id === 'btn-detailed-department') generateDetailedByDepartment();
            if (button.id === 'btn-earnings-table') generateEarningsTable();
        });
    });
}

function setupViewToggle() {
    const container = document.querySelector('.view-toggle');
    const buttons = container.querySelectorAll('button');
    const views = {
        'btn-expenses-main': 'charts-view',
        'btn-earnings-main': 'earnings-view',
        'btn-tables-main': 'tables-view'
    };

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const viewId = views[button.id];

            Object.values(views).forEach(id => document.getElementById(id).style.display = 'none');
            const viewEl = document.getElementById(viewId);
            viewEl.style.display = 'flex';

            if (viewId === 'tables-view') {
                document.getElementById('btn-summary-month')?.click();
            }
        });
    });
}

function generateSummaryByMonth() {
    const container = document.getElementById('table-summary-month');
    if (!container) return;
    data.months.forEach(month => {
        const monthData = data.data[month];
        if (!monthData) return;
        const section = document.createElement('div');
        section.innerHTML = `<h3>${formatMonthLabel(month)}</h3>`;
        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr><th>Departamento</th><th>Total</th></tr></thead>
            <tbody>
                ${Object.entries(monthData.departments).map(([dept, d]) => `<tr><td>${dept}</td><td>${formatCurrencyBRL(d.geral)}</td></tr>`).join('')}
                <tr style="font-weight: bold; background-color: #e0e0e0;"><td>Total Geral Mensal</td><td>${formatCurrencyBRL(monthData.total)}</td></tr>
                <tr style="font-weight: bold; background-color: #f0f0f0;"><td>Faturamento Mensal</td><td>${formatCurrencyBRL(monthData.earnings)}</td></tr>
            </tbody>`;
        section.appendChild(table);
        container.appendChild(section);
    });
}

function generateSummaryByDepartment() {
    const container = document.getElementById('table-summary-department');
    if (!container) return;
    data.departments.forEach(dept => {
        const section = document.createElement('div');
        section.innerHTML = `<h3>${dept}</h3>`;
        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr><th>Mês</th><th>Total Gasto</th><th>Funcionários</th></tr></thead>
            <tbody>
                ${data.months.map(month => {
                    const d = data.data[month]?.departments[dept];
                    return d ? `<tr><td>${formatMonthLabel(month)}</td><td>${formatCurrencyBRL(d.geral)}</td><td>${d.count || 0}</td></tr>` : '';
                }).join('')}
            </tbody>`;
        section.appendChild(table);
        container.appendChild(section);
    });
}

function generateDetailedByMonth() {
    const container = document.getElementById('table-detailed-month');
    if (!container) return;
    data.months.forEach(month => {
        const monthData = data.data[month];
        if (!monthData) return;
        const totalSimples = Object.values(monthData.departments).reduce((sum, dept) => sum + dept.total, 0);
        const totalVA = Object.values(monthData.departments).reduce((sum, dept) => sum + dept.valeAlimentacao, 0);
        const totalBonificacao = Object.values(monthData.departments).reduce((sum, dept) => sum + dept.bonificacao, 0);
        const totalGeral = Object.values(monthData.departments).reduce((sum, dept) => sum + dept.geral, 0);
        const section = document.createElement('div');
        section.innerHTML = `<h3>${formatMonthLabel(month)}</h3>`;
        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr><th>Departamento</th><th>Funcionários</th><th>Total Simples</th><th>Vale Alimentação</th><th>Bonificação (Dia 20)</th><th>Total Geral</th></tr></thead>
            <tbody>
                ${Object.keys(colorsByDepartment).map(dept => {
                    const d = monthData.departments[dept];
                    return d ? `<tr>
                        <td>${dept}</td><td>${d.count || 0}</td><td>${formatCurrencyBRL(d.total)}</td>
                        <td>${formatVA(d.valeAlimentacao, month)}</td><td>${formatCurrencyBRL(d.bonificacao)}</td><td>${formatCurrencyBRL(d.geral)}</td>
                    </tr>` : '';
                }).join('')}
            </tbody>
            <tfoot><tr style="font-weight: bold; background-color: #f0f0f0;">
                <td>Total Mensal</td><td>${monthData.totalEmployees}</td><td>${formatCurrencyBRL(totalSimples)}</td>
                <td>${formatVA(totalVA, month)}</td><td>${formatCurrencyBRL(totalBonificacao)}</td><td>${formatCurrencyBRL(totalGeral)}</td>
            </tr></tfoot>`;
        section.appendChild(table);
        container.appendChild(section);
    });
}

function generateDetailedByDepartment() {
    const container = document.getElementById('table-detailed-department');
    if (!container) return;
    data.departments.forEach(dept => {
        let totalSimples = 0, totalVA = 0, totalBonificacao = 0, totalGeral = 0, employeeSum = 0, monthCount = 0, lastMonthWithVA = '0000-00';
        data.months.forEach(month => {
            const d = data.data[month]?.departments[dept];
            if (d) {
                totalSimples += d.total; totalVA += d.valeAlimentacao; totalBonificacao += d.bonificacao;
                totalGeral += d.geral; employeeSum += d.count; monthCount++;
                if (d.valeAlimentacao > 0 || month >= '2025-01') lastMonthWithVA = month;
            }
        });
        const avgEmployees = monthCount > 0 ? (employeeSum / monthCount).toFixed(1) : 0;
        const section = document.createElement('div');
        section.innerHTML = `<h3>${dept}</h3>`;
        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr><th>Mês</th><th>Funcionários</th><th>Total Simples</th><th>Vale Alimentação</th><th>Bonificação (Dia 20)</th><th>Total Geral</th></tr></thead>
            <tbody>
                ${data.months.map(month => {
                    const d = data.data[month]?.departments[dept];
                    return d ? `<tr>
                        <td>${formatMonthLabel(month)}</td><td>${d.count || 0}</td><td>${formatCurrencyBRL(d.total)}</td>
                        <td>${formatVA(d.valeAlimentacao, month)}</td><td>${formatCurrencyBRL(d.bonificacao)}</td><td>${formatCurrencyBRL(d.geral)}</td>
                    </tr>` : '';
                }).join('')}
            </tbody>
            <tfoot><tr style="font-weight: bold; background-color: #f0f0f0;">
                <td>Total / Média</td><td>${avgEmployees} (Média)</td><td>${formatCurrencyBRL(totalSimples)}</td>
                <td>${formatVA(totalVA, lastMonthWithVA)}</td><td>${formatCurrencyBRL(totalBonificacao)}</td><td>${formatCurrencyBRL(totalGeral)}</td>
            </tr></tfoot>`;
        section.appendChild(table);
        container.appendChild(section);
    });
}

function generateEarningsTable() {
    const container = document.getElementById('table-earnings');
    if (!container) return;
    const section = document.createElement('div');
    section.innerHTML = `<h3>Faturamento Mensal</h3>`;
    const table = document.createElement('table');
    table.innerHTML = `
        <thead><tr><th>Mês</th><th>Faturamento</th><th>Gastos com Pessoal</th><th>Diferença</th><th>Margem (%)</th></tr></thead>
        <tbody>
            ${data.months.map(month => {
                const monthData = data.data[month];
                if (!monthData) return '';
                const earnings = monthData.earnings || 0, totalCosts = monthData.total || 0, netProfit = earnings - totalCosts;
                const profitMargin = (earnings > 0) ? (netProfit / earnings) * 100 : 0;
                return `<tr>
                    <td>${formatMonthLabel(month)}</td><td>${formatCurrencyBRL(earnings)}</td><td>${formatCurrencyBRL(totalCosts)}</td>
                    <td style="color: ${netProfit >= 0 ? '#024B59' : '#E44D42'}; font-weight: bold;">${formatCurrencyBRL(netProfit)}</td>
                    <td style="color: ${profitMargin >= 0 ? '#024B59' : '#E44D42'}; font-weight: bold;">${profitMargin.toFixed(2)}%</td>
                </tr>`;
            }).join('')}
        </tbody>`;
    section.appendChild(table);
    container.appendChild(section);
}

// --- Chart and Filter Setup ---
function setupTimeFilters() {
    const trendsWrapper = document.getElementById('department-trends-wrapper');
    const tryParseJSON = (jsonString) => {
        if (!jsonString || jsonString === 'undefined' || jsonString === 'null') return [];
        if (jsonString === 'all') return data.departments || [];
        try { return JSON.parse(jsonString); } catch (e) { return []; }
    };
    
    const filterButtonsContainer = document.querySelector('#total-expenditures-wrapper .filter-buttons-wrapper');
    filterButtonsContainer.innerHTML = '<div class="filter-grid"></div>';
    const filterGrid = filterButtonsContainer.querySelector('.filter-grid');

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

    filterGrid.appendChild(row1);
    filterGrid.appendChild(row2);


    document.querySelectorAll('#total-expenditures-wrapper .time-filters .filter-btn, #total-expenditures-wrapper .filter-buttons-wrapper .filter-btn').forEach(button => {
        button.addEventListener('click', function() {
            const parent = this.closest('.card');
            parent.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            if(this.closest('.time-filters')) {
                 const activeDept = document.querySelector('#total-expenditures-wrapper .filter-buttons-wrapper .filter-btn.active').dataset.department;
                 charts.totalExpenditures.update(data.data, data.months.slice(-this.dataset.months), activeDept);
            } else {
                const activeMonths = document.querySelector('#total-expenditures-wrapper .time-filters .filter-btn.active').dataset.months;
                charts.totalExpenditures.update(data.data, data.months.slice(-activeMonths), this.dataset.department);
            }
        });
    });

    if (trendsWrapper) {
        trendsWrapper.querySelectorAll('.toggle-switch-group .filter-btn').forEach(button => {
            button.addEventListener('click', function() {
                const parent = this.closest('.toggle-switch-group');
                parent.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                const monthsRange = trendsWrapper.querySelector('.time-filters .filter-btn.active')?.dataset?.months || 'all';
                const monthsToShow = monthsRange === 'all' ? data.months : data.months.slice(-monthsRange);
                const selectedDepartments = tryParseJSON(trendsWrapper.querySelector('.filter-buttons .filter-btn.active')?.dataset?.departments || 'all');
                charts.departmentTrends.update(monthsToShow, selectedDepartments);
            });
        });
    }
}

// --- Chart Creation Functions ---
const globalChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
        y: {
            from: 500
        },
        duration: 800
    }
};

function createTotalExpendituresChart(chartData, months) {
    const canvas = document.getElementById('total-expenditures-chart');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Gastos Totais', data: months.map(month => chartData[month]?.total || 0),
                borderColor: '#024B59', backgroundColor: hexToRGBA('#024B59', 0.1),
                borderWidth: 2, fill: true, tension: 0.4
            }]
        },
        options: { ...globalChartOptions, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) }, grace: '10%' } } }
    });
    return {
        update: function(newData, monthsToShow, selectedDepartment = 'all') {
            if (!monthsToShow) return;
            chart.data.labels = monthsToShow.map(formatMonthShort);
            const dataset = { borderColor: '#024B59', backgroundColor: hexToRGBA('#024B59', 0.1), borderWidth: 2, fill: true, tension: 0.4 };
            if (selectedDepartment === 'all') {
                dataset.label = 'Gastos Totais';
                dataset.data = monthsToShow.map(month => newData[month]?.total || 0);
            } else {
                const color = colorsByDepartment[selectedDepartment] || '#cccccc';
                dataset.label = `Gastos - ${selectedDepartment}`;
                dataset.data = monthsToShow.map(m => newData[m]?.departments?.[selectedDepartment]?.geral || 0);
                dataset.borderColor = color;
                dataset.backgroundColor = hexToRGBA(color, 0.12);
            }
            chart.data.datasets = [dataset];
            chart.update();
        }
    };
}

function createDepartmentTrendsChart(chartData, months, departments) {
    const ctx = document.getElementById('department-trends-chart');
    if (!ctx) return null;
    const chart = new Chart(ctx.getContext('2d'), {
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
    return {
        update: function(monthsToShow = months, filteredDepartments = departments) {
            if (!monthsToShow) return;
            chart.data.labels = monthsToShow.map(formatMonthShort);
            chart.data.datasets = filteredDepartments.map(dept => ({
                label: dept, data: monthsToShow.map(month => data.data[month]?.departments[dept]?.geral || 0),
                borderColor: colorsByDepartment[dept] || "#ccc", borderWidth: 2, fill: false, tension: 0.3
            }));
            chart.update();
        }
    };
}

function createAvgExpenditureChart(chartData, months) {
    const ctx = document.getElementById('avg-expenditure-chart');
    if (!ctx) return null;
    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Média de Gastos por Funcionário',
                data: months.map(month => (chartData[month]?.totalEmployees > 0) ? chartData[month].total / chartData[month].totalEmployees : 0),
                borderColor: '#024B59', backgroundColor: hexToRGBA('#024B59', 0.1), borderWidth: 2, fill: true, tension: 0.4
            }]
        },
        options: { ...globalChartOptions, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Média: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) }, grace: '10%' } } }
    });
}

function createEmployeesChart(chartData, months) {
    const ctx = document.getElementById('employees-chart');
    if (!ctx) return null;
    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Total de Funcionários', data: months.map(month => chartData[month]?.totalEmployees || 0),
                borderColor: '#024B59', backgroundColor: hexToRGBA('#024B59', 0.1), borderWidth: 2, fill: true, tension: 0.4
            }]
        },
        options: { ...globalChartOptions, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Total: ${context.parsed.y}` } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

function createPercentageStackedChart(chartData, months, departments) {
    const ctx = document.getElementById('percentage-stacked-chart');
    if (!ctx) return null;
    new Chart(ctx.getContext('2d'), {
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
        options: { ...globalChartOptions, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
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
        options: { ...globalChartOptions, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Diferença: ${formatCurrencyBRL(context.parsed.y)}` } } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
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


// --- Pie Chart Section Functions ---
function setupDepartmentBreakdown() {
    const wrapper = document.getElementById('department-breakdown-wrapper');
    if (!wrapper) return;
    
    wrapper.innerHTML = `
        <h2>Distribuição de Gastos por Departamento</h2>
        <div class="centered-toggle">
            <div class="time-filters toggle-switch-group">
                <button class="filter-btn pie-time-btn" data-months="1">1 Mês</button>
                <button class="filter-btn pie-time-btn" data-months="3">3 Meses</button>
                <button class="filter-btn pie-time-btn" data-months="6">6 Meses</button>
                <button class="filter-btn pie-time-btn active" data-months="12">12 Meses</button>
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
        
        setTimeout(() => {
            const chart = new Chart(canvas, {
                type: 'pie',
                data: {
                    labels: filteredDeptData.map(d => d.name),
                    datasets: [{
                        data: filteredDeptData.map(d => d.value),
                        backgroundColor: filteredDeptData.map(d => colorsByDepartment[d.name] || "#ccc"),
                        borderWidth: 1
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
        }, index * 75);
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
        
        document.addEventListener('DOMContentLoaded', setupDepartmentBreakdown);
    </script>
</body>
</html>

function showError(message) {
    const container = document.querySelector('.container') || document.body;
    container.innerHTML = `<div class="error-message"><h2>Erro</h2><p>${message}</p><button onclick="window.location.reload()">Recarregar Página</button></div>`;
}
