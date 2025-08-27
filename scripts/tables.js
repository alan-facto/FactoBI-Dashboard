import { data, colorsByDepartment, formatMonthLabel, formatCurrencyBRL, formatVA } from './main.js';

export function initTablesView() {
    setupTableToggle();
    generateSummaryByMonth(); // Pre-render the default table
}

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
            
            if (tableEl.innerHTML.trim() === '') {
                if (button.id === 'btn-summary-month') generateSummaryByMonth();
                if (button.id === 'btn-summary-department') generateSummaryByDepartment();
                if (button.id === 'btn-detailed-month') generateDetailedByMonth();
                if (button.id === 'btn-detailed-department') generateDetailedByDepartment();
                if (button.id === 'btn-earnings-table') generateEarningsTable();
            }
        });
    });
}

function generateSummaryByMonth() {
    const container = document.getElementById('table-summary-month');
    if (!container) return;
    container.innerHTML = ''; 
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
                <tr class="summary-row-1"><td>Total Geral Mensal</td><td>${formatCurrencyBRL(monthData.total)}</td></tr>
                <tr class="summary-row-2"><td>Faturamento Mensal</td><td>${formatCurrencyBRL(monthData.earnings)}</td></tr>
            </tbody>`;
        section.appendChild(table);
        container.appendChild(section);
    });
}

function generateSummaryByDepartment() {
    const container = document.getElementById('table-summary-department');
    if (!container) return;
    container.innerHTML = ''; 
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
    container.innerHTML = ''; 
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
            <tfoot><tr class="summary-row-2">
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
    container.innerHTML = '';
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
            <tfoot><tr class="summary-row-2">
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
    container.innerHTML = '';
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
                    <td>${formatMonthLabel(month)}</td>
                    <td>${formatCurrencyBRL(earnings)}</td>
                    <td>${formatCurrencyBRL(totalCosts)}</td>
                    <td class="${netProfit >= 0 ? 'positive' : 'negative'}">${formatCurrencyBRL(netProfit)}</td>
                    <td class="${profitMargin >= 0 ? 'positive' : 'negative'}">${profitMargin.toFixed(2)}%</td>
                </tr>`;
            }).join('')}
        </tbody>`;
    section.appendChild(table);
    container.appendChild(section);
}
