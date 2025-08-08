const apiUrl = "https://script.google.com/macros/s/AKfycbyHUho9j0-swZTJO4Fka_59Nv3GVFqo-Qfbp3yydchcKZaUUcs7HxlWZ5mUO6vjH4mPTA/exec";

// Structure to hold processed data
let data = { months: [], departments: [], data: {} };
let sortedMonths = [];

// Holds chart instances globally
let charts = {};

// Map sheet department names to dashboard names
const deptMap = {
  "Administrativo Financeiro": "Administrativo",
  "Operação Geral": "Operação",
  "Jurídico Externo": "Jurídico",
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

    console.log("Live data loaded:", data);
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

const canonicalDepartmentNames = {
  "administrativo financeiro": "Administrativo Financeiro",
  "apoio": "Apoio",
  "comercial": "Comercial",
  "diretoria": "Diretoria",
  "jurídico externo": "Jurídico Externo",
  "marketing": "Marketing",
  "NEC": "NEC",
  "operação geral": "Operação Geral",
  "RH / Departamento Pessoal": "RH / Departamento Pessoal"
};

const colorsByDepartment = {
  "Administrativo Financeiro": "#3E64FF", // Azul Lavanda Claro (adjusted to match your earlier custom color)
  "Apoio": "#6545CF", // Rosa Valdita
  "Comercial": "#00EB89", // Verde claro
  "Diretoria": "#F2D24C", // Amarelo Dourado
  "Jurídico Externo": "#DC4B45", // Vermelho Tomate
  "Marketing": "#0CBA8C", // Verde médio
  "NEC": "#024B59", // Verde escuro
  "Operação Geral": "#FF5E5B", // Rosa Salmão
  "RH / Departamento Pessoal": "#6545CF" // Rosa Valdita (same as Apoio)
};

function hexToRGBA(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeDepartmentName(name) {
  const key = name.toLowerCase().trim();
  return canonicalDepartmentNames[key] || name;
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
            <td>${normalizeDepartmentName(dept)}</td>
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
    section.innerHTML = `<h3>${normalizeDepartmentName(dept)}</h3>`;
    
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
          const d = data.data[month].departments[normalizeDepartmentName(dept)];
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
      const d = data.data[month].departments[normalizeDepartmentName(dept)];
      if (d) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${normalizeDepartmentName(dept)}</td>
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
    section.innerHTML = `<h3>${normalizeDepartmentName(dept)}</h3>`;

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
      const d = data.data[month].departments[normalizeDepartmentName(dept)];
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
      <td>${normalizeDepartmentName(dept)}</td>
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

// Chart creation functions
function createDepartmentBreakdownCharts(data, months, departments) {
    const container = document.getElementById('department-breakdown-charts');
    const legendContainer = document.getElementById('department-legend');

    container.innerHTML = '';
    legendContainer.innerHTML = '';

    const breakdownCharts = {};
    const recentMonths = months.slice(-6);
    let activeDepartments = [...departments];

    // Create pie charts
    recentMonths.forEach((month, index) => {
        const canvas = document.createElement('canvas');
        canvas.id = `department-breakdown-chart-${index}`;
        canvas.setAttribute('width', '150');
        canvas.setAttribute('height', '150');
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const monthData = data[month];

        breakdownCharts[month] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: activeDepartments,
                datasets: [{
                    data: activeDepartments.map(dept => monthData.departments[normalizeDepartmentName(dept)]?.geral || 0),
                    backgroundColor: activeDepartments.map(dept => colorsByDepartment[dept] || "#ccc")
                }]
            },
            options: {
                responsive: false,
                plugins: {
                    title: {
                        display: true,
                        text: formatMonthLabel(month),
                        padding: {
                            top: 4,
                            bottom: 4
                        },
                        font: {
                            size: 12
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                layout: {
                    padding: 0
                }
            }
        });
    });

    // Create styled legend
    departments.forEach(dept => {
        const item = document.createElement('div');
        item.className = 'department-legend-item';
        item.dataset.department = dept;

        const swatch = document.createElement('span');
        swatch.className = 'department-legend-swatch';
        swatch.style.backgroundColor = colorsByDepartment[dept] || '#ccc';

        const label = document.createElement('span');
        label.textContent = normalizeDepartmentName(dept);

        item.appendChild(swatch);
        item.appendChild(label);

        item.addEventListener('click', () => {
            const index = activeDepartments.indexOf(dept);
            if (index !== -1) {
                activeDepartments.splice(index, 1);
                item.classList.add('inactive');
            } else {
                activeDepartments.push(dept);
                item.classList.remove('inactive');
            }

            // Update all pie charts
            recentMonths.forEach(month => {
                const chart = breakdownCharts[month];
                const monthData = data[month];
                chart.data.labels = activeDepartments;
                chart.data.datasets[0].data = activeDepartments.map(d => monthData.departments[d]?.total || 0);
                chart.data.datasets[0].backgroundColor = activeDepartments.map(d => colorsByDepartment[d] || '#ccc');
                chart.update();
            });
        });

        legendContainer.appendChild(item);
    });

    return {
        update: () => {} // Optional future update hook
    };
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


const datasets = departments.map((dept) => ({
  label: normalizeDepartmentName(dept),
  data: months.map(month => data[month]?.departments[dept]?.geral || 0),
  borderColor: colorsByDepartment[dept] || "#ccc",
  backgroundColor: colorsByDepartment[dept] || "#ccc",
  borderWidth: 2,
  fill: false,
  tension: 0.3
}));

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: R$ ${context.raw.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}`;
                        }
                    }
                },
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
                        }
                    }
                }
            }
        }
    });

    return {
    update: function(monthsToShow, filteredDepartments = departments) {
        chart.data.labels = monthsToShow;
        chart.data.datasets = filteredDepartments.map((dept) => ({
    label: normalizeDepartmentName(dept),
    data: monthsToShow.map(month => data[month]?.departments[dept]?.total || 0),
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



function createPercentageStackedChart(data, months, departments) {
    const ctx = document.getElementById('percentage-stacked-chart');
    if (!ctx) return null;

    // Build datasets with percentages
    const datasets = departments.map((dept, index) => {
        const dataPoints = months.map(month => {
            const monthData = data[month];
            const deptTotal = monthData?.departments[dept]?.geral || 0;
            const total = monthData?.total || 1;
            return (deptTotal / total) * 100;
        });

        return {
  label: dept,
  data: dataPoints,
  backgroundColor: colorsByDepartment[dept] || "#ccc",
  borderColor: colorsByDepartment[dept] || "#ccc",
  stack: 'stack1'
};
    });

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: months,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                        }
                    }
                },
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return `${value}%`;
                        }
                    }
                }
            }
        }
    });

    return {
        update: function(newMonths) {
            chart.data.labels = newMonths.map(formatMonthShort);

            chart.data.datasets.forEach((dataset, index) => {
                const dept = departments[index];
                dataset.data = newMonths.map(month => {
                    const monthData = data[month];
                    const deptTotal = monthData?.departments[dept]?.total || 0;
                    const total = monthData?.total || 1;
                    return (deptTotal / total) * 100;
                });
            });

            chart.update();
        }
    };
}

function createChartIfExists(chartId, creationFunction, data, ...args) {
    const canvas = document.getElementById(chartId);
    if (!canvas) {
        console.warn(`Canvas element #${chartId} not found - skipping chart creation`);
        return null;
    }
    return creationFunction(data, ...args);
}

function createTotalExpendituresChart(data, months, departments) {
    const ctx = document.getElementById('total-expenditures-chart');
    if (!ctx) return null;
    
    const departmentData = {};
    departments.forEach(dept => {
        departmentData[dept] = months.map(month => data[month]?.departments[dept]?.geral || 0);
    });

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: months.map(formatMonthShort),
            datasets: [{
                label: 'Gastos Totais',
                data: months.map(month => {
                    const depts = data[month].departments || {};
                    return Object.values(depts).reduce((sum, d) => sum + (d.geral || 0), 0);
                }),
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
                            return `Gastos Totais: R$ ${context.raw.toLocaleString('pt-BR', {
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
    
    document.querySelectorAll('#total-expenditures-wrapper .filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.expenditure-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const department = this.dataset.department;
            
            if (department === 'all') {
                chart.data.datasets = [{
                    label: 'Gastos Totais',
                    data: months.map(month => {
                        const depts = data[month].departments || {};
                        return Object.values(depts).reduce((sum, d) => sum + (d.geral || 0), 0);
                    }),
                    borderColor: '#024B59',
                    backgroundColor: hexToRGBA('#024B59', 0.1),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }];
            } else {
                chart.data.datasets = [{
                    label: `Gastos - ${department}`,
                    data: departmentData[department],
                    borderColor: colorsByDepartment[department] || '#e74c3c',
                    backgroundColor: hexToRGBA(colorsByDepartment[department] || '#e74c3c', 0.1),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }];
            }
            
            chart.update();
        });
    });

    return {
        update: function(newData, monthsToShow, selectedDepartment = 'all') {
            departments.forEach(dept => {
                departmentData[dept] = monthsToShow.map(month => newData[month]?.departments[dept]?.geral || 0);
            });

            chart.data.labels = monthsToShow.map(formatMonthShort);

            if (selectedDepartment === 'all') {
                chart.data.datasets = [{
                    label: 'Gastos Totais',
                    data: monthsToShow.map(month => {
                        const depts = newData[month].departments || {};
                        return Object.values(depts).reduce((sum, d) => sum + (d.geral || 0), 0);
                    }),
                    borderColor: '#024B59',
                    backgroundColor: hexToRGBA('#024B59', 0.1),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }];
            } else {
                const color = colorsByDepartment[selectedDepartment] || '#ccc';
                chart.data.datasets = [{
                    label: `Gastos - ${selectedDepartment}`,
                    data: departmentData[selectedDepartment],
                    borderColor: color,
                    backgroundColor: hexToRGBA(color, 0.1),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }];
            }

            chart.update();
        }
    };
}

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
