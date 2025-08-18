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
let sortedMonths = [];
let charts = {};

// --- Mappings and Helpers ---
const deptMap = {
    "Administrativo Financeiro": "Administrativo",
    "Apoio": "Apoio",
    "Comercial": "Comercial",
    "Diretoria": "Diretoria",
    "Jurídico Externo": "Jurídico",
    "Marketing": "Marketing",
    "NEC": "NEC",
    "Operação Geral": "Operação",
    "RH / Departamento Pessoal": "RH"
};

/**
 * [FIXED] Converts various date string formats into a standardized "YYYY-MM" format.
 * This new version is more robust and uses explicit regex matching for each expected
 * format to prevent misinterpretation and ensure consistent keys for data consolidation.
 * @param {string} monthStr - The date string to convert.
 * @returns {string|null} The date in "YYYY-MM" format or null if parsing fails.
 */
function convertMonthToYYYYMM(monthStr) {
    if (!monthStr || typeof monthStr !== 'string') {
        return null;
    }
    const s = monthStr.trim();

    // Priority 1: YYYY-MM-DD or YYYY-MM
    let match = s.match(/^(\d{4})-(\d{2})/);
    if (match) {
        // match[1] is YYYY, match[2] is MM
        return `${match[1]}-${match[2]}`;
    }

    // Priority 2: DD/MM/YYYY
    match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
        // match[1] is DD, match[2] is MM, match[3] is YYYY
        return `${match[3]}-${match[2].padStart(2, '0')}`;
    }

    // Priority 3: MM/YYYY
    match = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (match) {
        // match[1] is MM, match[2] is YYYY
        return `${match[2]}-${match[1].padStart(2, '0')}`;
    }

    // Priority 4: mmm.-yy (e.g., "mar.-25")
    match = s.match(/(\w{3,})\.-(\d{2})$/i); // case-insensitive
    if (match) {
        const monthAbbr = match[1].substring(0, 3).toLowerCase();
        const yearShort = match[2];
        const yearFull = parseInt(yearShort, 10) < 70 ? `20${yearShort}` : `19${yearShort}`;
        const monthMap = {
            "jan": "01", "fev": "02", "mar": "03", "abr": "04", "mai": "05", "jun": "06",
            "jul": "07", "ago": "08", "set": "09", "out": "10", "nov": "11", "dez": "12"
        };
        const monthNum = monthMap[monthAbbr];
        if (monthNum) {
            return `${yearFull}-${monthNum}`;
        }
    }

    console.warn('Unrecognized month format, could not parse:', s);
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

        // Discover all unique months from BOTH sources first
        [...fetchedRows, ...earningsData].forEach(row => {
            const monthKey = convertMonthToYYYYMM(row["Month"] || row["Mês"]);
            if (monthKey) monthsSet.add(monthKey);
        });

        // Initialize the data structure for all discovered months
        monthsSet.forEach(month => {
            if (!structuredData[month]) {
                structuredData[month] = { departments: {}, total: 0, totalEmployees: 0, earnings: 0 };
            }
        });

        // Populate with expenditure data
        fetchedRows.forEach(row => {
            const monthKey = convertMonthToYYYYMM(row["Month"]);
            if (!monthKey || !structuredData[monthKey]) return;

            const rawDept = row["Department"];
            const dept = deptMap[rawDept] || rawDept;
            const total = parseFloat(row["Total"]) || 0;
            const bonificacao = parseFloat(row["Bonificacao 20"]) || 0;
            const valeAlimentacao = parseFloat(row["Vale Alimentação"]) || 0;
            const count = parseInt(row["Employee Count"]) || 0;
            const geral = total + bonificacao; // Total Geral is base + bonificação

            if (dept && dept.toLowerCase() !== "total geral") {
                departmentsSet.add(dept);
                if (!structuredData[monthKey].departments[dept]) {
                    structuredData[monthKey].departments[dept] = { total: 0, bonificacao: 0, valeAlimentacao: 0, count: 0, geral: 0 };
                }
                // Assign new values
                structuredData[monthKey].departments[dept] = { total, bonificacao, valeAlimentacao, count, geral };
                structuredData[monthKey].total += geral;
                structuredData[monthKey].totalEmployees += count;
            }
        });

        // Merge earnings data
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

        sortedMonths = data.months.slice();
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
    "NEC": "#9370DB", "Operação": "#00A86B", "RH": "#FF69B4"
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
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatVA(value, month) {
    if (month < '2025-07' && (value === 0 || value === null || value === undefined)) {
        return 'N/A';
    }
    return formatCurrencyBRL(value);
}


// --- UI Setup and Generation ---
function setupTableToggle() {
    const buttons = {
        'btn-summary-month': 'table-summary-month', 'btn-summary-department': 'table-summary-department',
        'btn-detailed-month': 'table-detailed-month', 'btn-detailed-department': 'table-detailed-department',
        'btn-earnings-table': 'table-earnings'
    };
    Object.entries(buttons).forEach(([btnId, tableId]) => {
        document.getElementById(btnId)?.addEventListener('click', () => {
            Object.values(buttons).forEach(id => document.getElementById(id).style.display = 'none');
            Object.keys(buttons).forEach(id => document.getElementById(id)?.classList.remove('active'));
            const tableEl = document.getElementById(tableId);
            tableEl.style.display = 'block';
            document.getElementById(btnId).classList.add('active');
            tableEl.innerHTML = '';
            if (btnId === 'btn-summary-month') generateSummaryByMonth();
            if (btnId === 'btn-summary-department') generateSummaryByDepartment();
            if (btnId === 'btn-detailed-month') generateDetailedByMonth();
            if (btnId === 'btn-detailed-department') generateDetailedByDepartment();
            if (btnId === 'btn-earnings-table') generateEarningsTable();
        });
    });
}

function setupViewToggle() {
    const btnExpensesMain = document.getElementById('btn-expenses-main');
    const btnEarningsMain = document.getElementById('btn-earnings-main');
    const btnTablesMain = document.getElementById('btn-tables-main');
    const chartsView = document.getElementById('charts-view');
    const tablesView = document.getElementById('tables-view');
    const earningsView = document.getElementById('earnings-view');

    const setActiveView = (activeBtn, activeViewDiv) => {
        [btnExpensesMain, btnEarningsMain, btnTablesMain].forEach(btn => btn.classList.remove('active'));
        [chartsView, tablesView, earningsView].forEach(view => view.style.display = 'none');
        activeBtn.classList.add('active');
        activeViewDiv.style.display = 'flex';
        if (activeViewDiv === tablesView) {
            document.getElementById('btn-summary-month')?.click();
        }
    };

    btnExpensesMain.addEventListener('click', () => setActiveView(btnExpensesMain, chartsView));
    btnEarningsMain.addEventListener('click', () => setActiveView(btnEarningsMain, earningsView));
    btnTablesMain.addEventListener('click', () => setActiveView(btnTablesMain, tablesView));
    
    setActiveView(btnExpensesMain, chartsView);
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
        table.className = 'summary';
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
        table.className = 'summary';
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

        // Calculate totals for the footer
        const totalSimples = Object.values(monthData.departments).reduce((sum, dept) => sum + dept.total, 0);
        const totalVA = Object.values(monthData.departments).reduce((sum, dept) => sum + dept.valeAlimentacao, 0);
        const totalBonificacao = Object.values(monthData.departments).reduce((sum, dept) => sum + dept.bonificacao, 0);
        const totalGeral = Object.values(monthData.departments).reduce((sum, dept) => sum + dept.geral, 0);

        const section = document.createElement('div');
        section.innerHTML = `<h3>${formatMonthLabel(month)}</h3>`;
        const table = document.createElement('table');
        table.style.tableLayout = 'auto'; // [FIX] Override fixed layout to prevent overflow

        table.innerHTML = `
            <thead><tr><th>Departamento</th><th>Funcionários</th><th>Total Simples</th><th>Vale Alimentação</th><th>Bonificação (Dia 20)</th><th>Total Geral</th></tr></thead>
            <tbody>
                ${data.departments.map(dept => {
                    const d = monthData.departments[dept];
                    return d ? `<tr>
                        <td>${dept}</td>
                        <td>${d.count || 0}</td>
                        <td>${formatCurrencyBRL(d.total)}</td>
                        <td>${formatVA(d.valeAlimentacao, month)}</td>
                        <td>${formatCurrencyBRL(d.bonificacao)}</td>
                        <td>${formatCurrencyBRL(d.geral)}</td>
                    </tr>` : '';
                }).join('')}
            </tbody>
            <tfoot>
                <tr style="font-weight: bold; background-color: #f0f0f0;">
                    <td>Total Mensal</td>
                    <td>${monthData.totalEmployees}</td>
                    <td>${formatCurrencyBRL(totalSimples)}</td>
                    <td>${formatVA(totalVA, month)}</td>
                    <td>${formatCurrencyBRL(totalBonificacao)}</td>
                    <td>${formatCurrencyBRL(totalGeral)}</td>
                </tr>
            </tfoot>
        `;
        section.appendChild(table);
        container.appendChild(section);
    });
}

function generateDetailedByDepartment() {
    const container = document.getElementById('table-detailed-department');
    if (!container) return;
    data.departments.forEach(dept => {
        // Calculate totals and averages for the footer
        let totalSimples = 0;
        let totalVA = 0;
        let totalBonificacao = 0;
        let totalGeral = 0;
        let employeeSum = 0;
        let monthCount = 0;
        let lastMonthWithVA = '0000-00';

        data.months.forEach(month => {
            const d = data.data[month]?.departments[dept];
            if (d) {
                totalSimples += d.total;
                totalVA += d.valeAlimentacao;
                totalBonificacao += d.bonificacao;
                totalGeral += d.geral;
                employeeSum += d.count;
                monthCount++;
                if (d.valeAlimentacao > 0 || month >= '2025-07') {
                    lastMonthWithVA = month;
                }
            }
        });
        const avgEmployees = monthCount > 0 ? (employeeSum / monthCount).toFixed(1) : 0;

        const section = document.createElement('div');
        section.innerHTML = `<h3>${dept}</h3>`;
        const table = document.createElement('table');
        table.style.tableLayout = 'auto'; // [FIX] Override fixed layout to prevent overflow

        table.innerHTML = `
            <thead><tr><th>Mês</th><th>Funcionários</th><th>Total Simples</th><th>Vale Alimentação</th><th>Bonificação (Dia 20)</th><th>Total Geral</th></tr></thead>
            <tbody>
                ${data.months.map(month => {
                    const d = data.data[month]?.departments[dept];
                    return d ? `<tr>
                        <td>${formatMonthLabel(month)}</td>
                        <td>${d.count || 0}</td>
                        <td>${formatCurrencyBRL(d.total)}</td>
                        <td>${formatVA(d.valeAlimentacao, month)}</td>
                        <td>${formatCurrencyBRL(d.bonificacao)}</td>
                        <td>${formatCurrencyBRL(d.geral)}</td>
                    </tr>` : '';
                }).join('')}
            </tbody>
            <tfoot>
                 <tr style="font-weight: bold; background-color: #f0f0f0;">
                    <td>Total / Média</td>
                    <td>${avgEmployees} (Média)</td>
                    <td>${formatCurrencyBRL(totalSimples)}</td>
                    <td>${formatVA(totalVA, lastMonthWithVA)}</td>
                    <td>${formatCurrencyBRL(totalBonificacao)}</td>
                    <td>${formatCurrencyBRL(totalGeral)}</td>
                </tr>
            </tfoot>
        `;
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
    table.className = 'summary';
    table.innerHTML = `
        <thead><tr><th>Mês</th><th>Faturamento</th><th>Gastos Totais</th><th>Lucro / Prejuízo Líquido</th><th>Margem de Lucro (%)</th></tr></thead>
        <tbody>
            ${data.months.map(month => {
                const monthData = data.data[month];
                if (!monthData) return '';
                const earnings = monthData.earnings || 0;
                const totalCosts = monthData.total || 0;
                const netProfit = earnings - totalCosts;
                const profitMargin = (earnings > 0) ? (netProfit / earnings) * 100 : 0;
                return `<tr>
                    <td>${formatMonthLabel(month)}</td>
                    <td>${formatCurrencyBRL(earnings)}</td>
                    <td>${formatCurrencyBRL(totalCosts)}</td>
                    <td style="color: ${netProfit >= 0 ? '#00A86B' : '#E44D42'}; font-weight: bold;">${formatCurrencyBRL(netProfit)}</td>
                    <td style="color: ${profitMargin >= 0 ? '#00A86B' : '#E44D42'}; font-weight: bold;">${profitMargin.toFixed(2)}%</td>
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
        try {
            return JSON.parse(jsonString);
        } catch (e) { return []; }
    };
    
    document.querySelectorAll('#total-expenditures-wrapper .time-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('#total-expenditures-wrapper .time-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const activeDepartment = document.querySelector('#total-expenditures-wrapper .filter-buttons .filter-btn.active').dataset.department;
            charts.totalExpenditures.update(data.data, data.months.slice(-button.dataset.months), activeDepartment);
        });
    });

    document.querySelectorAll('#total-expenditures-wrapper .filter-buttons .filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('#total-expenditures-wrapper .filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const selectedDepartment = button.dataset.department;
            const activeMonths = document.querySelector('#total-expenditures-wrapper .time-btn.active').dataset.months;
            charts.totalExpenditures.update(data.data, data.months.slice(-activeMonths), selectedDepartment);
        });
    });

    if (trendsWrapper) {
        const updateChart = () => {
            if (!charts.departmentTrends?.update) return;
            const monthsRange = trendsWrapper.querySelector('.time-btn.active')?.dataset?.months || 'all';
            const monthsToShow = monthsRange === 'all' ? data.months : data.months.slice(-monthsRange);
            const selectedDepartments = tryParseJSON(trendsWrapper.querySelector('.filter-buttons .filter-btn.active')?.dataset?.departments || 'all');
            charts.departmentTrends.update(monthsToShow, selectedDepartments);
        };
        trendsWrapper.querySelectorAll('.time-btn, .filter-buttons .filter-btn').forEach(button => {
            button.addEventListener('click', function() {
                this.parentElement.querySelectorAll('.filter-btn, .time-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                updateChart();
            });
        });
    }
}

// --- Chart Creation Functions (no changes needed) ---
function createTotalExpendituresChart(chartData, months, departments) {
    const canvas = document.getElementById('total-expenditures-chart');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Gastos Totais',
                data: months.map(month => chartData[month]?.total || 0),
                borderColor: '#024B59',
                backgroundColor: hexToRGBA('#024B59', 0.1),
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
    return {
        update: function(newData, monthsToShow, selectedDepartment = 'all') {
            if (!monthsToShow) return;
            chart.data.labels = monthsToShow.map(formatMonthShort);
            const dataset = {
                borderColor: '#024B59',
                backgroundColor: hexToRGBA('#024B59', 0.1),
                borderWidth: 2,
                fill: true,
                tension: 0.4
            };
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
                label: dept,
                data: months.map(month => chartData[month]?.departments[dept]?.geral || 0),
                borderColor: colorsByDepartment[dept] || "#ccc",
                borderWidth: 2,
                fill: false,
                tension: 0.3
            }))
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
    return {
        update: function(monthsToShow = months, filteredDepartments = departments) {
            if (!monthsToShow) return;
            chart.data.labels = monthsToShow.map(formatMonthShort);
            chart.data.datasets = filteredDepartments.map(dept => ({
                label: dept,
                data: monthsToShow.map(month => data.data[month]?.departments[dept]?.geral || 0),
                borderColor: colorsByDepartment[dept] || "#ccc",
                borderWidth: 2,
                fill: false,
                tension: 0.3
            }));
            chart.update();
        }
    };
}

function createAvgExpenditureChart(chartData, months) {
    const ctx = document.getElementById('avg-expenditure-chart');
    if (!ctx) return null;
    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Média de Gastos por Funcionário',
                data: months.map(month => (chartData[month]?.totalEmployees > 0) ? chartData[month].total / chartData[month].totalEmployees : 0),
                borderColor: '#024B59',
                backgroundColor: hexToRGBA('#024B59', 0.1),
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
    return { update: (newMonths) => {
        if (!newMonths) return;
        chart.data.labels = newMonths.map(formatMonthShort);
        chart.data.datasets[0].data = newMonths.map(month => (data.data[month]?.totalEmployees > 0) ? data.data[month].total / data.data[month].totalEmployees : 0);
        chart.update();
    }};
}

function createEmployeesChart(chartData, months) {
    const ctx = document.getElementById('employees-chart');
    if (!ctx) return null;
    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Total de Funcionários',
                data: months.map(month => chartData[month]?.totalEmployees || 0),
                borderColor: '#024B59',
                backgroundColor: hexToRGBA('#024B59', 0.1),
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
    return { update: (newMonths) => {
        if (!newMonths) return;
        chart.data.labels = newMonths.map(formatMonthShort);
        chart.data.datasets[0].data = newMonths.map(month => data.data[month]?.totalEmployees || 0);
        chart.update();
    }};
}

function createPercentageStackedChart(chartData, months, departments) {
    const ctx = document.getElementById('percentage-stacked-chart');
    if (!ctx) return null;
    const chart = new Chart(ctx.getContext('2d'), {
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
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, scales: { x: { stacked: true }, y: { stacked: true, max: 100, ticks: { callback: (value) => value + "%" } } } }
    });
    return { update: (newMonths) => {
        if (!newMonths) return;
        chart.data.labels = newMonths.map(formatMonthShort);
        chart.data.datasets.forEach((dataset, idx) => {
            const dept = departments[idx];
            dataset.data = newMonths.map(month => {
                const total = data.data[month]?.total || 1;
                return (total > 0) ? ((data.data[month]?.departments[dept]?.geral || 0) / total) * 100 : 0;
            });
        });
        chart.update();
    }};
}

function createDepartmentBreakdownCharts(chartData, months, departments) {
    const container = document.getElementById('department-breakdown-charts');
    if (!container) return null;
    container.innerHTML = '';
    const recentMonths = months.slice(-6);
    recentMonths.forEach(month => {
        const pieItem = document.createElement('div');
        pieItem.className = 'pie-item';
        const canvas = document.createElement('canvas');
        pieItem.appendChild(canvas);
        const label = document.createElement('div');
        label.className = 'pie-label';
        label.textContent = formatMonthLabel(month);
        pieItem.appendChild(label);
        container.appendChild(pieItem);
        new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: departments,
                datasets: [{
                    data: departments.map(dept => chartData[month]?.departments[dept]?.geral || 0),
                    backgroundColor: departments.map(dept => colorsByDepartment[dept] || "#ccc")
                }]
            },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
        });
    });
    return { update: () => {} };
}

function createEarningsVsCostsChart(chartData, months) {
    const ctx = document.getElementById('earnings-vs-costs-chart');
    if (!ctx) return null;
    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [
                { label: 'Faturamento', data: months.map(m => chartData[m]?.earnings || 0), borderColor: '#00A86B', tension: 0.4 },
                { label: 'Gastos Totais', data: months.map(m => chartData[m]?.total || 0), borderColor: '#E44D42', tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
     return { update: (newMonths) => {
        if (!newMonths) return;
        chart.data.labels = newMonths.map(formatMonthShort);
        chart.data.datasets[0].data = newMonths.map(m => data.data[m]?.earnings || 0);
        chart.data.datasets[1].data = newMonths.map(m => data.data[m]?.total || 0);
        chart.update();
    }};
}

function createNetProfitLossChart(chartData, months) {
    const ctx = document.getElementById('net-profit-loss-chart');
    if (!ctx) return null;
    const chart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Lucro / Prejuízo Líquido',
                data: months.map(m => (chartData[m]?.earnings || 0) - (chartData[m]?.total || 0)),
                backgroundColor: months.map(m => ((chartData[m]?.earnings || 0) - (chartData[m]?.total || 0)) >= 0 ? '#00A86B' : '#E44D42')
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
    return { update: (newMonths) => {
        if (!newMonths) return;
        chart.data.labels = newMonths.map(formatMonthShort);
        const newData = newMonths.map(m => (data.data[m]?.earnings || 0) - (data.data[m]?.total || 0));
        chart.data.datasets[0].data = newData;
        chart.data.datasets[0].backgroundColor = newData.map(val => val >= 0 ? '#00A86B' : '#E44D42');
        chart.update();
    }};
}

function createProfitMarginChart(chartData, months) {
    const ctx = document.getElementById('profit-margin-chart');
    if (!ctx) return null;
    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Margem de Lucro',
                data: months.map(m => {
                    const earnings = chartData[m]?.earnings || 0;
                    return earnings > 0 ? ((earnings - (chartData[m]?.total || 0)) / earnings) * 100 : 0;
                }),
                borderColor: '#0072B5',
                tension: 0.4,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (value) => value.toFixed(0) + "%" } } } }
    });
    return { update: (newMonths) => {
        if (!newMonths) return;
        chart.data.labels = newMonths.map(formatMonthShort);
        chart.data.datasets[0].data = newMonths.map(m => {
            const earnings = data.data[m]?.earnings || 0;
            return earnings > 0 ? ((earnings - (data.data[m]?.total || 0)) / earnings) * 100 : 0;
        });
        chart.update();
    }};
}

function createEarningsPerEmployeeChart(chartData, months) {
    const ctx = document.getElementById('earnings-per-employee-chart');
    if (!ctx) return null;
    let mode = 'company';
    const getChartData = (m, currentMode) => {
        const earnings = chartData[m]?.earnings || 0;
        if (currentMode === 'operation') {
            const opEmployees = chartData[m]?.departments?.Operação?.count || 0;
            return opEmployees > 0 ? earnings / opEmployees : 0;
        }
        const totalEmployees = chartData[m]?.totalEmployees || 0;
        return totalEmployees > 0 ? earnings / totalEmployees : 0;
    };
    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Faturamento por Funcionário (Geral)',
                data: months.map(m => getChartData(m, mode)),
                borderColor: '#F28E2B',
                tension: 0.4,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (value) => formatCurrencyBRL(value) } } } }
    });
    document.getElementById('toggle-earnings-per-employee').addEventListener('click', (e) => {
        mode = mode === 'company' ? 'operation' : 'company';
        e.target.textContent = `Ver Faturamento por Funcionário (${mode === 'company' ? 'Operação' : 'Geral'})`;
        chart.data.datasets[0].data = data.months.map(m => getChartData(m, mode));
        chart.update();
    });
    return { update: (newMonths) => {
        if (!newMonths) return;
        chart.data.labels = newMonths.map(formatMonthShort);
        chart.data.datasets[0].data = newMonths.map(m => getChartData(m, mode));
        chart.update();
    }};
}

function createContributionEfficiencyChart(chartData, months, departments) {
    const ctx = document.getElementById('contribution-efficiency-chart');
    if (!ctx) return null;
    const chart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: months.map(formatMonthShort),
            datasets: departments.map(dept => ({
                label: dept,
                data: months.map(m => {
                    const earnings = chartData[m]?.earnings || 1;
                    return (earnings > 0) ? ((chartData[m]?.departments[dept]?.geral || 0) / earnings) * 100 : 0;
                }),
                backgroundColor: colorsByDepartment[dept] || "#ccc"
            }))
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: (value) => value.toFixed(0) + "%" } } } }
    });
    return { update: (newMonths) => {
        if (!newMonths) return;
        chart.data.labels = newMonths.map(formatMonthShort);
        chart.data.datasets.forEach((dataset, idx) => {
            const dept = departments[idx];
            dataset.data = newMonths.map(m => {
                const earnings = data.data[m]?.earnings || 1;
                return (earnings > 0) ? ((data.data[m]?.departments[dept]?.geral || 0) / earnings) * 100 : 0;
            });
        });
        chart.update();
    }};
}

// --- DASHBOARD INITIALIZATION ---
function initDashboard() {
    try {
        if (!data || !data.months.length) {
            throw new Error('Invalid or incomplete data. Cannot initialize dashboard.');
        }

        setupViewToggle();
        setupTableToggle();

        charts = {
            totalExpenditures: createTotalExpendituresChart(data.data, data.months, data.departments),
            departmentTrends: createDepartmentTrendsChart(data.data, data.months, data.departments),
            avgExpenditure: createAvgExpenditureChart(data.data, data.months),
            employees: createEmployeesChart(data.data, data.months),
            percentageStacked: createPercentageStackedChart(data.data, data.months, data.departments),
            departmentBreakdown: createDepartmentBreakdownCharts(data.data, data.months, data.departments),
            earningsVsCosts: createEarningsVsCostsChart(data.data, data.months),
            netProfitLoss: createNetProfitLossChart(data.data, data.months),
            profitMargin: createProfitMarginChart(data.data, data.months),
            earningsPerEmployee: createEarningsPerEmployeeChart(data.data, data.months),
            contributionEfficiency: createContributionEfficiencyChart(data.data, data.months, data.departments)
        };

        setupTimeFilters();

        setTimeout(() => {
            document.querySelector('#total-expenditures-wrapper .time-btn[data-months="12"]')?.click();
            document.querySelector('#department-trends-wrapper .time-btn[data-months="12"]')?.click();
        }, 300);

    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        showError('Falha ao carregar o dashboard. Por favor, recarregue a página.');
    }
}

function showError(message) {
    const container = document.querySelector('.container') || document.body;
    container.innerHTML = `<div class="error-message"><h2>Erro</h2><p>${message}</p><button onclick="window.location.reload()">Recarregar Página</button></div>`;
}
