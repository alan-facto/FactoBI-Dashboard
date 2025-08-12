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
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(fetchedRows => {
    if (!fetchedRows || !Array.isArray(fetchedRows)) {
      throw new Error('Invalid data format received from API');
    }

    const monthsSet = new Set();
    const departmentsSet = new Set();
    const structuredData = {};

    // Initialize structure for all expected months
    const allMonths = [...new Set(fetchedRows.map(row => row["Month"]).sort())];
    allMonths.forEach(month => {
      structuredData[month] = {
        departments: {},
        total: 0,
        totalEmployees: 0
      };
    });

    fetchedRows.forEach(row => {
      try {
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
          
          // Initialize department if not exists
          if (!structuredData[month].departments[dept]) {
            structuredData[month].departments[dept] = {
              total: 0,
              bonificacao: 0,
              count: 0,
              geral: 0
            };
          }

          structuredData[month].departments[dept] = { 
            total, 
            bonificacao, 
            count, 
            geral 
          };
          structuredData[month].total += geral;
          structuredData[month].totalEmployees += count;
        }
      } catch (error) {
        console.error('Error processing row:', row, error);
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
    // Show error message to user
    const container = document.querySelector('.container');
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <h2>Erro ao carregar dados</h2>
          <p>${error.message}</p>
          <button onclick="window.location.reload()">Tentar Novamente</button>
        </div>
      `;
    }
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
    "Administrativo": "#6B5B95",  // Royal purple (unique, authoritative)
    "Apoio": "#FF6F61",          // Coral (friendly, energetic)
    "Comercial": "#E44D42",      // Bright red (urgent, salesy)
    "Diretoria": "#0072B5",      // Vivid blue (leadership, trust)
    "Jurídico": "#2E8B57",       // Forest green (stable, legal)
    "Marketing": "#FFA500",      // Orange (creative, bold - but not neon)
    "NEC": "#9370DB",            // Medium purple (distinctive)
    "Operação": "#00A86B",       // Jade green (fresh, operational)
    "RH": "#FF69B4"              // Hot pink (friendly, human touch)
};

function hexToRGBA(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tryParseJSON(jsonString) {
    // Handle all possible undefined/null cases
    if (jsonString === undefined || jsonString === null || 
        jsonString === 'undefined' || jsonString === 'null') {
        return [];
    }
    
    // Handle empty string case
    if (jsonString.trim() === '') {
        return [];
    }
    
    // Handle the "all" special case
    if (jsonString === 'all') {
        return data.departments || [];
    }
    
    // Finally attempt JSON parsing
    try {
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn('Failed to parse JSON, using empty array as fallback:', jsonString);
        return [];
    }
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

// Replace the current setupTableToggle() with this:
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
        // Hide all tables first
        Object.values(buttons).forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
        
        // Remove active class from all buttons
        Object.keys(buttons).forEach(id => {
          const btn = document.getElementById(id);
          if (btn) btn.classList.remove('active');
        });

        // Show selected table and activate button
        const tableEl = document.getElementById(tableId);
        if (tableEl) {
          tableEl.style.display = 'block';
          button.classList.add('active');
          
          // Clear and regenerate content every time
          tableEl.innerHTML = '';
          
          if (btnId === 'btn-summary-month') generateSummaryByMonth();
          if (btnId === 'btn-summary-department') generateSummaryByDepartment();
          if (btnId === 'btn-detailed-month') generateDetailedByMonth();
          if (btnId === 'btn-detailed-department') generateDetailedByDepartment();
        }
      });
    }
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

  // Initialize view states
  chartsView.style.display = 'block';
  tablesView.style.display = 'none';

  btnGraphs.addEventListener('click', () => {
    btnGraphs.classList.add('active');
    btnTables.classList.remove('active');
    chartsView.style.display = 'block';
    tablesView.style.display = 'none';
    
    // Redraw charts when switching back to graphs view
    setTimeout(() => {
      Object.values(charts).forEach(chart => {
        if (chart && chart.update) chart.update();
      });
    }, 100);
  });

  btnTables.addEventListener('click', () => {
    btnGraphs.classList.remove('active');
    btnTables.classList.add('active');
    chartsView.style.display = 'none';
    tablesView.style.display = 'block';
    
    // Generate default table view if needed
    if (document.getElementById('table-summary-month').innerHTML === '') {
      generateSummaryByMonth();
    }
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
	table.className = 'summary';
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
	table.className = 'summary';
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
        // Toggle active state
        document.querySelectorAll('#total-expenditures-wrapper .time-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Get currently selected department filter
        const activeDepartment = document.querySelector('#total-expenditures-wrapper .filter-btn.active').dataset.department;
        // Get months based on clicked button
        const monthsToShow = getMonthsToShow(data.months, button.dataset.months);

        charts.totalExpenditures.update(data.data, monthsToShow, activeDepartment);
    });
});

// Department filter for Total Expenditures
document.querySelectorAll('#total-expenditures-wrapper .filter-buttons .filter-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('#total-expenditures-wrapper .filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const selectedDepartment = button.dataset.department;
        const activeMonths = document.querySelector('#total-expenditures-wrapper .time-btn.active').dataset.months;
        const monthsToShow = getMonthsToShow(data.months, activeMonths);

        charts.totalExpenditures.update(data.data, monthsToShow, selectedDepartment);
    });
});

    // Department Trends - Time Filters
document.querySelectorAll('#department-trends-wrapper .time-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('#department-trends-wrapper .time-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const raw = document.querySelector('#department-trends-wrapper .filter-buttons .filter-btn.active')?.dataset?.departments || 'all';
        const selectedDepartments = tryParseJSON(raw);
        const monthsToShow = getMonthsToShow(data.months, button.dataset.months);

        if (charts.departmentTrends?.update) {
            charts.departmentTrends.update(monthsToShow, selectedDepartments);
        } else {
            console.warn('Department trends chart not ready yet');
        }
    });
});

// Department Trends - Department Filters
document.querySelectorAll('#department-trends-wrapper .filter-buttons .filter-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('#department-trends-wrapper .filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const selectedDepartments = tryParseJSON(button.dataset.departments || 'all');
        const activeMonths = document.querySelector('#department-trends-wrapper .time-btn.active')?.dataset?.months || 'all';
        const monthsToShow = getMonthsToShow(data.months, activeMonths);

        if (charts.departmentTrends?.update) {
            charts.departmentTrends.update(monthsToShow, selectedDepartments);
        } else {
            console.warn('Department trends chart not ready yet');
        }
    });
});

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
    const trendsWrapper = document.getElementById('department-trends-wrapper');
    if (!trendsWrapper) {
        console.warn('Department trends wrapper element not found');
        return;
    }

    // Safely get active departments
    const getActiveDepartments = () => {
        const activeBtn = trendsWrapper.querySelector('.filter-btn.active');
        if (!activeBtn || !activeBtn.dataset) {
            return data.departments || [];
        }
        return tryParseJSON(activeBtn.dataset.departments);
    };

    // Safely update the chart
    const updateChart = () => {
        if (!charts.departmentTrends?.update) {
            console.warn('Department trends chart not available for update');
            return;
        }

        try {
            const activeTimeBtn = trendsWrapper.querySelector('.time-btn.active');
            const monthsRange = activeTimeBtn?.dataset?.months || 'all';
            const monthsToShow = getMonthsToShow(data.months, monthsRange);
            const departmentsToShow = getActiveDepartments();
            
            charts.departmentTrends.update(monthsToShow, departmentsToShow);
        } catch (e) {
            console.error('Chart update failed:', e);
        }
    };

    // Setup time filter buttons
    const timeButtons = trendsWrapper.querySelectorAll('.time-btn');
    timeButtons.forEach(button => {
        button.addEventListener('click', function() {
            timeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            updateChart();
        });
    });

    // Setup department filter buttons
    const filterButtons = trendsWrapper.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            updateChart();
        });
    });

    // Initialize default state
    setTimeout(() => {
        // Set default time filter if none active
        if (!trendsWrapper.querySelector('.time-btn.active')) {
            const defaultTimeBtn = trendsWrapper.querySelector('.time-btn[data-months="3"]');
            if (defaultTimeBtn) defaultTimeBtn.classList.add('active');
        }

        // Set default department filter if none active
        if (!trendsWrapper.querySelector('.filter-btn.active')) {
            const defaultFilterBtn = trendsWrapper.querySelector('.filter-btn[data-departments="all"]');
            if (defaultFilterBtn) defaultFilterBtn.classList.add('active');
        }

        updateChart();
    }, 150);
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
                maintainAspectRatio: true,
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
    },
    legend: { display: false } // <-- hide legend
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
    },
    legend: { display: false } // <-- hide legend
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
    try {
        const ctx = document.getElementById('department-trends-chart');
        if (!ctx) {
            console.warn('Department trends chart canvas not found');
            return null;
        }

        // Filter out months with no data
         const validMonths = months.filter(month => {
            return data[month] && typeof data[month] === 'object' && 
                   month.match(/^\d{4}-\d{2}$/); // Validate YYYY-MM format
        });

        if (validMonths.length === 0) {
            console.warn('No valid months data for trends chart');
            return null;
        }

        // Filter out departments with no data
        const validDepartments = departments.filter(dept => {
            return validMonths.some(month => data[month]?.departments?.[dept]);
        });

        const datasets = validDepartments.map(dept => ({
            label: dept,
            data: validMonths.map(month => data[month]?.departments[dept]?.geral || 0),
            borderColor: colorsByDepartment[dept] || "#ccc",
            backgroundColor: 'transparent',
            borderWidth: 2,
            fill: false,
            tension: 0.3
        }));

        const chart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: validMonths.map(formatMonthShort),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.raw.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                });
                                return `${label}: ${value}`;
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                });
                            }
                        }
                    }
                }
            }
        });

        return {
            update: function(monthsToShow = validMonths, filteredDepartments = validDepartments) {
                try {
                    if (!chart) return;

                    const filteredMonths = monthsToShow.filter(month => data[month]);
                    const filteredDepts = filteredDepartments.filter(dept => 
                        validDepartments.includes(dept));

                    chart.data.labels = filteredMonths.map(formatMonthShort);
                    chart.data.datasets = filteredDepts.map(dept => ({
                        label: dept,
                        data: filteredMonths.map(month => data[month]?.departments[dept]?.geral || 0),
                        borderColor: colorsByDepartment[dept] || "#ccc",
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3
                    }));

                    chart.update();
                } catch (e) {
                    console.error('Error updating department trends chart:', e);
                }
            }
        };
    } catch (e) {
        console.error('Chart creation error:', e);
        return null;
    }
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
                    return `Gastos: R$ ${context.raw.toLocaleString('pt-BR', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                    })}`;
                }
            }
        },
        legend: { display: false } // hide legend
    },
    scales: {
        y: {
            beginAtZero: false,
            ticks: {
                callback: function(value) {
                    return `R$ ${Number(value).toLocaleString('pt-BR', { 
                        maximumFractionDigits: 0 
                    })}`;
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
    try {
        // Validate data structure more thoroughly
        if (!data || !Array.isArray(data.months) || !Array.isArray(data.departments) || typeof data.data !== 'object') {
            throw new Error('Invalid or incomplete data received from server');
        }

        // Check if we have at least some data
        if (data.months.length === 0 || data.departments.length === 0 || Object.keys(data.data).length === 0) {
            throw new Error('No data available to display');
        }

        // Initialize UI components
        try {
            setupViewToggle();
			setupTableToggle();

		// Initialize charts with additional checks
		charts = {};
        const chartElements = {
            'total-expenditures-chart': () => createTotalExpendituresChart(data.data, data.months, data.departments),
            'department-breakdown-charts': () => createDepartmentBreakdownCharts(data.data, data.months, data.departments),
            'employees-chart': () => createEmployeesChart(data.data, data.months),
            'avg-expenditure-chart': () => createAvgExpenditureChart(data.data, data.months),
            'department-trends-chart': () => createDepartmentTrendsChart(data.data, data.months, data.departments),
            'percentage-stacked-chart': () => createPercentageStackedChart(data.data, data.months, data.departments)
        };

        Object.entries(chartElements).forEach(([id, creator]) => {
    try {
        if (document.getElementById(id)) {
            charts[id] = creator();
        }
    } catch (chartError) {
        console.error(`Failed to create chart ${id}:`, chartError);
    }
});
		
		// Now that charts exist, bind filters
		setupTimeFilters();
		setupDepartmentTrendsFilters();

        // Generate initial table view
        if (document.getElementById('table-summary-month')) {
            try {
                generateSummaryByMonth();
            } catch (tableError) {
                console.error('Failed to generate initial table:', tableError);
            }
        }

        // Trigger initial updates with better error handling
        setTimeout(() => {
            try {
                // Default to 12 Meses for both charts
				const totalExpBtn = document.querySelector('#total-expenditures-wrapper .time-btn[data-months="12"]');
				const deptTrendsBtn = document.querySelector('#department-trends-wrapper .time-btn[data-months="12"]');
				
				// Ensure default department filters are set
				const totalExpDeptBtn = document.querySelector('#total-expenditures-wrapper .filter-btn[data-department="all"]');
				const deptTrendsDeptBtn = document.querySelector('#department-trends-wrapper .filter-btn[data-departments="all"]');
				
				if (totalExpDeptBtn) totalExpDeptBtn.classList.add('active');
				if (deptTrendsDeptBtn) deptTrendsDeptBtn.classList.add('active');

                
                if (totalExpBtn) totalExpBtn.click();
                if (deptTrendsBtn) deptTrendsBtn.click();
            } catch (initError) {
                console.error('Error during initial filter setup:', initError);
            }
        }, 300);

    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        showError('Falha ao carregar o dashboard. Por favor, recarregue a página.');
    }
	}

function showError(message) {
    const container = document.querySelector('.container') || document.body;
    container.innerHTML = `
        <div class="error-message" style="
            padding: 20px;
            background: #ffecec;
            border: 1px solid #ffb3b3;
            border-radius: 5px;
            max-width: 600px;
            margin: 50px auto;
            text-align: center;
        ">
            <h2 style="color: #d32f2f; margin-top: 0;">Erro</h2>
            <p style="margin-bottom: 20px;">${message}</p>
            <button onclick="window.location.reload()" style="
                background: #d32f2f;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
            ">
                Recarregar Página
            </button>
        </div>
    `;
}


