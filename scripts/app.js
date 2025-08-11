const apiUrl = "https://script.google.com/macros/s/AKfycbyHUho9j0-swZTJO4Fka_59Nv3GVFqo-Qfbp3yydchcKZaUUcs7HxlWZ5mUO6vjH4mPTA/exec";

// Structure to hold processed data
let data = { months: [], departments: [], data: {} };
let sortedMonths = [];

// Holds chart instances globally
let charts = {};

// Map sheet department names to dashboard names
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

// Fetch and process live data
fetch(apiUrl)
  .then(response => response.json())
  .then(fetchedRows => {
    const monthsSet = new Set();
    const departmentsSet = new Set();
    const structuredData = {};

    fetchedRows.forEach(row => {
      const month = row["Month"];
      const rawDept = row["Department"];
      const dept = deptMap[rawDept] || rawDept;
      const total = parseFloat(row["Total"]) || 0;
      const bonificacao = parseFloat(row["Bonificacao 20"]) || 0;
      const count = parseInt(row["Employee Count"]) || 0;
      const geral = parseFloat(row["Total Geral"]) || (total + bonificacao);

      monthsSet.add(month);

      if (dept.toLowerCase() !== "total geral") {
        departmentsSet.add(dept);

        if (!structuredData[month]) {
          structuredData[month] = {
            departments: {},
            total: 0,
            totalEmployees: 0
          };
        }

        structuredData[month].departments[dept] = { total, bonificacao, count, geral };
        structuredData[month].total += geral;
        structuredData[month].totalEmployees += count;
      }
    });

    data = {
      months: Array.from(monthsSet).sort(),
      departments: Array.from(departmentsSet),
      data: structuredData
    };

    sortedMonths = data.months.slice();

    initDashboard();
  })
  .catch(error => {
    console.error("Error loading data:", error);
  });


const translations = {
  "Total Expenditures": "Gastos Totais",
  "Company Average per Employee": "Média da Empresa por Funcionário",
  "Employees": "Funcionários",
  "Amount": "Valor",
  "Percentage": "Percentual",
  "Expenditure": "Gastos",
  "Total": "Total"
};

const colorsByDepartment = {
    "Administrativo": "#4e79a7",
    "Apoio": "#f28e2b",
    "Comercial": "#e15759",
    "Diretoria": "#76b7b2",
    "Jurídico": "#59a14f",
    "Marketing": "#edc948",
    "NEC": "#b07aa1",
    "Operação": "#ff9da7",
    "RH": "#9c755f"
};

function hexToRGBA(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeDepartmentName(name) {
  if (!name) return "";
  const key = name.toLowerCase().trim();
  // Find matching short name from deptMap
  for (const [longName, shortName] of Object.entries(deptMap)) {
    if (longName.toLowerCase() === key || shortName.toLowerCase() === key) {
      return shortName;
    }
  }
  return name; // fallback if no match
}

function formatMonthLabel(monthStr) {
  const [year, month] = monthStr.split("-");
  const monthsPt = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${monthsPt[parseInt(month) - 1]}/${year}`;
}

function formatMonthShort(monthStr) {
  const [year, month] = monthStr.split("-");
  return `${month}/${year}`;
}


function formatCurrencyBRL(value) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function generateDepartmentLegend(departments, colorMap) {
  const legendContainer = document.getElementById("department-legend");
  legendContainer.innerHTML = "";

  departments.forEach(dept => {
    const item = document.createElement("div");
    item.className = "department-legend-item";

    const swatch = document.createElement("span");
    swatch.className = "department-legend-swatch";
    swatch.style.backgroundColor = colorMap[dept] || "#ccc"; // fallback

    const label = document.createElement("span");
    label.textContent = dept;

    item.appendChild(swatch);
    item.appendChild(label);
    legendContainer.appendChild(item);
  });
}


function setupViewToggle() {
  const btnGraphs = document.getElementById('btn-graphs');
  const btnTables = document.getElementById('btn-tables');
  const chartsView = document.getElementById('charts-view');
  const tablesView = document.getElementById('tables-view');

  if (!btnGraphs || !btnTables || !chartsView || !tablesView) {
    console.warn('View toggle buttons or views not found. Skipping setupViewToggle.');
    return;
  }

  btnGraphs.addEventListener('click', () => {
    btnGraphs.classList.add('active');
    btnTables.classList.remove('active');
    chartsView.classList.remove('hidden');
    tablesView.classList.add('hidden');
  });

  btnTables.addEventListener('click', () => {
    btnGraphs.classList.remove('active');
    btnTables.classList.add('active');
    chartsView.classList.add('hidden');
    tablesView.classList.remove('hidden');
  });
}

function generateSummaryByMonth() {
  const container = document.getElementById('table-summary-month');
  container.innerHTML = '';

  data.months.forEach(month => {
    const monthData = data.data[month];
    const section = document.createElement('div');
    section.innerHTML = `<h3>${formatMonthLabel(month)}</h3>`;
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Departamento</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(monthData.departments).map(([dept, d]) => `
          <tr>
            <td>${dept}</td>
            <td>${formatCurrencyBRL(d.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    section.appendChild(table);
    container.appendChild(section);
  });
}


function generateSummaryByDepartment() {
  const container = document.getElementById('table-summary-department');
  container.innerHTML = '';

  data.departments.forEach(dept => {
    const section = document.createElement('div');
    section.innerHTML = `<h3>${dept}</h3>`;
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Mês</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.months.map(month => {
          const d = data.data[month].departments[dept];
          return d ? `
            <tr>
              <td>${formatMonthLabel(month)}</td>
              <td>${formatCurrencyBRL(d.total)}</td>
            </tr>
          ` : '';
        }).join('')}
      </tbody>
    `;
    section.appendChild(table);
    container.appendChild(section);
  });
}


function generateDetailedByMonth() {
  const container = document.getElementById('table-detailed-month');
  container.innerHTML = '';

  data.months.forEach(month => {
    const section = document.createElement('div');
    section.innerHTML = `<h3>${formatMonthLabel(month)}</h3>`;
    
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    thead.innerHTML = `
      <tr>
        <th>Departamento</th>
        <th>Funcionários</th>
        <th>Total</th>
        <th>Bonificação Dia 20</th>
        <th>Total Geral</th>
      </tr>
    `;

    data.departments.forEach(dept => {
      const d = data.data[month].departments[dept];
      if (d) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${dept}</td>
          <td>${d.count || 0}</td>
          <td>${formatCurrencyBRL(d.total)}</td>
          <td>${formatCurrencyBRL(d.bonificacao)}</td>
          <td>${formatCurrencyBRL(d.geral)}</td>
        `;
        tbody.appendChild(row);
      }
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    section.appendChild(table);
    container.appendChild(section);
  });
}


function generateDetailedByDepartment() {
  const container = document.getElementById('table-detailed-department');
  container.innerHTML = '';

  data.departments.forEach(dept => {
    const section = document.createElement('div');
    section.innerHTML = `<h3>${dept}</h3>`;

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    thead.innerHTML = `
      <tr>
        <th>Mês</th>
        <th>Funcionários</th>
        <th>Total</th>
        <th>Bonificação Dia 20</th>
        <th>Total Geral</th>
      </tr>
    `;

    data.months.forEach(month => {
      const d = data.data[month].departments[dept];
      if (d) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${formatMonthLabel(month)}</td>
          <td>${d.count || 0}</td>
          <td>${formatCurrencyBRL(d.total)}</td>
          <td>${formatCurrencyBRL(d.bonificacao)}</td>
          <td>${formatCurrencyBRL(d.total + d.bonificacao)}</td>
        `;
        tbody.appendChild(row);
      }
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    section.appendChild(table);
    container.appendChild(section);
  });
}


function generateDepartmentTable() {
  const container = document.getElementById('table-by-department');
  container.innerHTML = '';

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  const header = ['Departamento', ...data.months];
  thead.innerHTML = `<tr>${header.map(h => `<th>${h}</th>`).join('')}</tr>`;

  data.departments.forEach(dept => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${dept}</td>
      ${data.months.map(month => {
        const value = data.data[month].departments[dept]?.total || 0;
        return `<td>${formatCurrencyBRL(value)}</td>`;
      }).join('')}
    `;
    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

function getMonthsToShow(allMonths, range) {
    if (range === 'all') return allMonths;
    return allMonths.slice(-parseInt(range));
}

function translateTooltip(context) {
    const label = context.dataset.label || '';
    const translatedLabel = translations[label] || label;
    const value = context.raw.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    if (label.includes('Expenditure') || label.includes('Total')) {
        return `${translatedLabel}: R$ ${value}`;
    }
    
    if (label.includes('Employee') || label.includes('Average')) {
        return `${translatedLabel}: R$ ${value}`;
    }
    
    if (label.includes('Employees')) {
        return `${translatedLabel}: ${context.raw}`;
    }
    
    return translatedLabel + ': ' + context.raw;
}

function setupTimeFilters() {
    // Total Expenditures
    document.querySelectorAll('#total-expenditures-wrapper .time-btn').forEach(button => {
        button.addEventListener('click', () => {
            const monthsToShow = getMonthsToShow(data.months, button.dataset.months);
            document.querySelectorAll('#total-expenditures-wrapper .time-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const activeDepartment = document.querySelector('#total-expenditures-wrapper .filter-btn.active').dataset.department;
            charts.totalExpenditures.update(data.data, monthsToShow, activeDepartment);
        });
    });

    // Department Trends
    document.querySelectorAll('#department-trends-wrapper .time-btn').forEach(button => {
        button.addEventListener('click', () => {
            const monthsToShow = getMonthsToShow(data.months, button.dataset.months);
            document.querySelectorAll('#department-trends-wrapper .time-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const raw = document.querySelector('#department-trends-wrapper .filter-btn.active').dataset.departments;
            const selectedDepartments = raw === 'all' ? data.departments : JSON.parse(raw);
            charts.departmentTrends.update(monthsToShow, selectedDepartments);
        });
    });
}


function setupTableToggle() {
  const buttons = {
    'btn-summary-month': 'table-summary-month',
    'btn-summary-department': 'table-summary-department',
    'btn-detailed-month': 'table-detailed-month',
    'btn-detailed-department': 'table-detailed-department'
  };

  Object.entries(buttons).forEach(([btnId, tableId]) => {
    const button = document.getElementById(btnId);
    if (button) {
      button.addEventListener('click', () => {
        // Toggle active button
        Object.keys(buttons).forEach(id => {
          document.getElementById(id)?.classList.remove('active');
          document.getElementById(buttons[id])?.classList.add('hidden');
        });

        button.classList.add('active');
        document.getElementById(tableId).classList.remove('hidden');

        // Generate on demand
        if (btnId === 'btn-summary-month') generateSummaryByMonth();
        if (btnId === 'btn-summary-department') generateSummaryByDepartment();
        if (btnId === 'btn-detailed-month') generateDetailedByMonth();
        if (btnId === 'btn-detailed-department') generateDetailedByDepartment();
      });
    }
  });
}

function setupDepartmentTrendsFilters() {
    document.querySelectorAll('#department-trends-wrapper .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#department-trends-wrapper .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const raw = btn.dataset.departments;
            const selected = raw === 'all' ? data.departments : JSON.parse(raw);
            const monthsToShow = getMonthsToShow(data.months, document.querySelector('#department-trends-wrapper .time-btn.active').dataset.months);
            charts.departmentTrends.update(monthsToShow, selected);
        });
    });

    document.querySelectorAll('#total-expenditures-wrapper .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#total-expenditures-wrapper .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const department = btn.dataset.department;
            const monthsToShow = getMonthsToShow(data.months, document.querySelector('#total-expenditures-wrapper .time-btn.active').dataset.months);
            charts.totalExpenditures.update(data.data, monthsToShow, department);
        });
    });

document.querySelectorAll('#department-breakdown-wrapper .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#department-breakdown-wrapper .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const raw = btn.dataset.departments;
        const selected = raw === 'all' ? data.departments : JSON.parse(raw);
        charts.departmentBreakdown.update(selected);
    });
});

}

function createChartIfExists(chartId, creationFunction, data, ...args) {
    const canvas = document.getElementById(chartId);
    if (!canvas) {
        console.warn(`Canvas element #${chartId} not found - skipping chart creation`);
        return null;
    }
    return creationFunction(data, ...args);
}

// Chart creation functions

function createDepartmentBreakdownCharts(data, months, departments) {
    const container = document.getElementById('department-breakdown-charts');
    const legendContainer = document.getElementById('department-legend');

    // Destroy any existing Chart.js instances
    Array.from(container.querySelectorAll('canvas')).forEach(c => {
        const chart = Chart.getChart(c);
        if (chart) chart.destroy();
    });

    // Clear containers
    container.innerHTML = '';
    legendContainer.innerHTML = '';

    const breakdownCharts = {};
    const recentMonths = months.slice(-6); // last 6 months
    const disabledDepartments = new Set();

    const getActiveDepartments = () => departments.filter(d => !disabledDepartments.has(d));

    // Create one pie chart per month
    recentMonths.forEach(month => {
        const pieItem = document.createElement('div');
        pieItem.className = 'pie-item';

        const canvas = document.createElement('canvas');
        pieItem.appendChild(canvas);

        const label = document.createElement('div');
        label.className = 'pie-label';
        label.textContent = formatMonthLabel(month); // helper to format month name
        pieItem.appendChild(label);

        container.appendChild(pieItem);

        const activeDepts = getActiveDepartments();

        breakdownCharts[month] = new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: activeDepts,
                datasets: [{
                    data: activeDepts.map(dept => data[month].departments[dept]?.geral || 0),
                    backgroundColor: activeDepts.map(dept => colorsByDepartment[dept] || "#ccc"),
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let value = context.raw;
                                return `${context.label}: ${formatCurrencyBRL(value)}`;
                            }
                        }
                    }
                }
            }
        });
    });

    // Shared legend
    departments.forEach(dept => {
        const legendItem = document.createElement('div');
        legendItem.className = 'department-legend-item';
        legendItem.dataset.department = dept;

        const swatch = document.createElement('span');
        swatch.className = 'department-legend-swatch';
        swatch.style.backgroundColor = colorsByDepartment[dept] || '#ccc';

        const label = document.createElement('span');
        label.textContent = dept;

        legendItem.appendChild(swatch);
        legendItem.appendChild(label);

        // Legend click toggle
        legendItem.addEventListener('click', () => {
            if (disabledDepartments.has(dept)) {
                disabledDepartments.delete(dept);
                legendItem.classList.remove('inactive');
            } else {
                disabledDepartments.add(dept);
                legendItem.classList.add('inactive');
            }

            const activeDepts = getActiveDepartments();

            // Update all pies
            recentMonths.forEach(month => {
                const chart = breakdownCharts[month];
                chart.data.labels = activeDepts;
                chart.data.datasets[0].data = activeDepts.map(d => data[month].departments[d]?.geral || 0);
                chart.data.datasets[0].backgroundColor = activeDepts.map(d => colorsByDepartment[d] || '#ccc');
                chart.update();
            });
        });

        legendContainer.appendChild(legendItem);
    });

    return { update: () => {} };
}


function createEmployeesChart(data, months) {
    const ctx = document.getElementById('employees-chart');
    if (!ctx) return null;

    const employeeCounts = months.map(month => data[month]?.totalEmployees || 0);

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Total de Funcionários',
                data: employeeCounts,
                borderColor: '#024B59',
		backgroundColor: hexToRGBA('#024B59', 0.1),
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Total de Funcionários: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });

    return {
        update: function(newMonths) {
            chart.data.labels = newMonths.map(formatMonthShort);
            chart.data.datasets[0].data = newMonths.map(month => data[month]?.totalEmployees || 0);
            chart.update();
        }
    };
}

function createAvgExpenditureChart(data, months) {
    const ctx = document.getElementById('avg-expenditure-chart');
    if (!ctx) return null;

    const avgPerEmployee = months.map(month => {
        const monthData = data[month];
        if (!monthData || !monthData.totalEmployees) return 0;
        return monthData.total / monthData.totalEmployees;
    });

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Média de Gastos por Funcionário',
                data: avgPerEmployee,
                borderColor: '#024B59',
		backgroundColor: hexToRGBA('#024B59', 0.1),
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            return `Média: R$ ${value.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return `R$ ${value.toLocaleString('pt-BR', {
                                maximumFractionDigits: 0
                            })}`;
                        }
                    }
                }
            }
        }
    });

    return {
        update: function(newMonths) {
            chart.data.labels = newMonths.map(formatMonthShort);
            chart.data.datasets[0].data = newMonths.map(month => {
                const m = data[month];
                return m?.totalEmployees ? m.total / m.totalEmployees : 0;
            });
            chart.update();
        }
    };
}

function createDepartmentTrendsChart(data, months, departments) {
    const ctx = document.getElementById('department-trends-chart');
    if (!ctx) return null;

    const datasets = departments.map(dept => ({
        label: dept,
        data: months.map(month => data[month]?.departments[dept]?.geral || 0),
        borderColor: colorsByDepartment[dept] || "#ccc",
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false,
        tension: 0.3
    }));

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: { labels: months.map(formatMonthShort), datasets },
        options: { /* same as before */ }
    });

    return {
        update: function(monthsToShow, filteredDepartments = departments) {
            chart.data.labels = monthsToShow.map(formatMonthShort);
            chart.data.datasets = filteredDepartments.map(dept => ({
                label: dept,
                data: monthsToShow.map(month => data[month]?.departments[dept]?.geral || 0),
                borderColor: colorsByDepartment[dept] || "#ccc",
                backgroundColor: 'transparent',
                borderWidth: 2,
                fill: false,
                tension: 0.3
            }));
            chart.update();
        }
    };
}

function createPercentageStackedChart(data, months, departments) {
    const ctx = document.getElementById('percentage-stacked-chart');
    if (!ctx) return null;

    const datasets = departments.map(dept => ({
        label: dept,
        data: months.map(month => {
            const deptTotal = data[month]?.departments[dept]?.geral || 0;
            const total = data[month]?.total || 1;
            return (deptTotal / total) * 100;
        }),
        backgroundColor: colorsByDepartment[dept] || "#ccc",
        borderColor: colorsByDepartment[dept] || "#ccc",
        stack: 'stack1'
    }));

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: months.map(formatMonthShort), datasets },
        options: { /* same as before */ }
    });

    return {
        update: function(newMonths) {
            chart.data.labels = newMonths.map(formatMonthShort);
            chart.data.datasets.forEach((dataset, idx) => {
                const dept = departments[idx];
                dataset.data = newMonths.map(month => {
                    const deptTotal = data[month]?.departments[dept]?.geral || 0;
                    const total = data[month]?.total || 1;
                    return (deptTotal / total) * 100;
                });
            });
            chart.update();
        }
    };
}

const deptReverseMap = {
    "Administrativo": "Administrativo Financeiro",
    "Jurídico": "Jurídico Externo",
    "Operação": "Operação Geral",
    "RH": "RH / Departamento Pessoal",
};

function toOriginalDept(shortName) {
    return deptReverseMap[shortName] || shortName;
}

function createTotalExpendituresChart(data, months, departments) {
    const canvas = document.getElementById('total-expenditures-chart');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    // Use a stable copy of months for initial series building
    const initialMonths = months.slice();

    // Build department series keyed by normalized (short) name
    const departmentData = {};
    departments.forEach(dept => {
        const key = normalizeDepartmentName(dept);
        departmentData[key] = initialMonths.map(month => data[month]?.departments?.[key]?.geral || 0);
    });

    // Totals series (sum of all departments for each month)
    const totalsSeries = initialMonths.map(month => {
        const depts = data[month]?.departments || {};
        return Object.values(depts).reduce((sum, d) => sum + (d?.geral || 0), 0);
    });

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: initialMonths.map(formatMonthShort),
            datasets: [{
                label: 'Gastos Totais',
                data: totalsSeries,
                borderColor: '#024B59',
                backgroundColor: hexToRGBA('#024B59', 0.1),
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Gastos: R$ ${context.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                    }
                },
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return `R$ ${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
                        }
                    }
                }
            }
        }
    });

    return {
        /**
         * newData: the data object (same structure: newData[month].departments[dept].geral)
         * monthsToShow: array of month keys (e.g. ['2024-01', '2024-02', ...'])
         * selectedDepartment: either 'all' or a department string (short or long)
         */
        update: function(newData, monthsToShow, selectedDepartment = 'all') {
            // defensive clone (avoid mutating caller's array)
            const monthsArr = Array.isArray(monthsToShow) ? monthsToShow.slice() : initialMonths.slice();

            // Normalize selectedDepartment to the short key used in your data object
            const selectedShort = (selectedDepartment === 'all' ? 'all' : normalizeDepartmentName(selectedDepartment));

            // Ensure department series exist for the months we're about to show.
            // Rebuild from newData if needed (handles case where department keys differ)
            Object.keys(departmentData).forEach(short => {
                // if lengths mismatch or months differ, rebuild
                departmentData[short] = monthsArr.map(m => newData[m]?.departments?.[short]?.geral || 0);
            });

            chart.data.labels = monthsArr.map(formatMonthShort);

            if (selectedShort === 'all') {
                // show total series (recompute from newData to be safe)
                const totals = monthsArr.map(month => {
                    const depts = newData[month]?.departments || {};
                    return Object.values(depts).reduce((s, d) => s + (d?.geral || 0), 0);
                });

                chart.data.datasets = [{
                    label: 'Gastos Totais',
                    data: totals,
                    borderColor: '#024B59',
                    backgroundColor: hexToRGBA('#024B59', 0.1),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }];
            } else {
                // show single-department series, using normalized key
                const series = departmentData[selectedShort] ??
                    monthsArr.map(m => newData[m]?.departments?.[selectedShort]?.geral || 0);

                const color = colorsByDepartment[selectedShort] || colorsByDepartment[normalizeDepartmentName(selectedShort)] || '#cccccc';

                chart.data.datasets = [{
                    label: `Gastos - ${selectedShort}`,
                    data: series,
                    borderColor: color,
                    backgroundColor: hexToRGBA(color, 0.12),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }];
            }

            chart.update();
            // ensure canvas is resized properly (helps avoid blurriness if container changed)
            try { chart.resize(); } catch (e) { /* ignore if Chart.js version doesn't expose resize */ }
        }
    };
}


Chart.defaults.devicePixelRatio = window.devicePixelRatio;

function initDashboard() {
  const months = data.months;
  const departments = data.departments;

  // Initialize all chart instances
  charts = {
    totalExpenditures: createChartIfExists('total-expenditures-chart', createTotalExpendituresChart, data.data, months, departments),
    departmentBreakdown: createDepartmentBreakdownCharts(data.data, months, departments),
    employeesChart: createChartIfExists('employees-chart', createEmployeesChart, data.data, months),
    avgExpenditure: createChartIfExists('avg-expenditure-chart', createAvgExpenditureChart, data.data, months),
    departmentTrends: createChartIfExists('department-trends-chart', createDepartmentTrendsChart, data.data, months, departments),
    percentageStacked: createChartIfExists('percentage-stacked-chart', createPercentageStackedChart, data.data, months, departments),
  };

  // Initialize UI interactions
  setupTimeFilters();
  setupViewToggle();

  if (document.getElementById('btn-summary-month')) {
    setupTableToggle();
    generateSummaryByMonth();
  }

  setupDepartmentTrendsFilters();

  // Trigger default chart filters
  document.querySelector('#total-expenditures-wrapper .time-btn.active')?.click();
  document.querySelector('#department-trends-wrapper .time-btn.active')?.click();
}















