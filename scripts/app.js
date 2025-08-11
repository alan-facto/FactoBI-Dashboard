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
    if (!jsonString || jsonString === 'undefined') return [];
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('Failed to parse JSON:', jsonString);
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
    // Store the current filter states
    const filterStates = {
        totalExpenditures: {
            months: '3', // default to 3 months
            department: 'all'
        },
        departmentTrends: {
            months: '3',
            departments: 'all'
        }
    };

    // Helper function to update the total expenditures chart
    const updateTotalExpendituresChart = () => {
        const state = filterStates.totalExpenditures;
        const monthsToShow = getMonthsToShow(data.months, state.months);
        charts.totalExpenditures?.update(data.data, monthsToShow, state.department);
    };

    // Helper function to update the department trends chart
    const updateDepartmentTrendsChart = () => {
        const state = filterStates.departmentTrends;
        const monthsToShow = getMonthsToShow(data.months, state.months);
        const departmentsToShow = state.departments === 'all' 
            ? data.departments 
            : tryParseJSON(state.departments) || data.departments;
        charts.departmentTrends?.update(monthsToShow, departmentsToShow);
    };

    // Total Expenditures filters
    document.querySelectorAll('#total-expenditures-wrapper .time-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('#total-expenditures-wrapper .time-btn').forEach(btn => 
                btn.classList.remove('active'));
            button.classList.add('active');
            
            filterStates.totalExpenditures.months = button.dataset.months;
            updateTotalExpendituresChart();
        });
    });

    document.querySelectorAll('#total-expenditures-wrapper .filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('#total-expenditures-wrapper .filter-btn').forEach(btn => 
                btn.classList.remove('active'));
            button.classList.add('active');
            
            filterStates.totalExpenditures.department = button.dataset.department;
            updateTotalExpendituresChart();
        });
    });

    // Department Trends filters
    document.querySelectorAll('#department-trends-wrapper .time-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('#department-trends-wrapper .time-btn').forEach(btn => 
                btn.classList.remove('active'));
            button.classList.add('active');
            
            filterStates.departmentTrends.months = button.dataset.months;
            updateDepartmentTrendsChart();
        });
    });

    document.querySelectorAll('#department-trends-wrapper .filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('#department-trends-wrapper .filter-btn').forEach(btn => 
                btn.classList.remove('active'));
            button.classList.add('active');
            
            filterStates.departmentTrends.departments = button.dataset.departments;
            updateDepartmentTrendsChart();
        });
    });

    // Initialize default states
    document.querySelector('#total-expenditures-wrapper .time-btn[data-months="3"]')?.classList.add('active');
    document.querySelector('#total-expenditures-wrapper .filter-btn[data-department="all"]')?.classList.add('active');
    document.querySelector('#department-trends-wrapper .time-btn[data-months="3"]')?.classList.add('active');
    document.querySelector('#department-trends-wrapper .filter-btn[data-departments="all"]')?.classList.add('active');
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
    try {
        const trendsWrapper = document.getElementById('department-trends-wrapper');
        if (!trendsWrapper) {
            console.warn('Department trends wrapper not found');
            return;
        }

        // Helper to safely get departments from button data
        const getDepartmentsFromButton = (button) => {
            if (!button || !button.dataset) return data.departments;
            
            const deptData = button.dataset.departments;
            if (deptData === 'all' || deptData === 'undefined' || !deptData) {
                return data.departments;
            }
            
            try {
                return deptData ? JSON.parse(deptData) : data.departments;
            } catch (e) {
                console.error('Failed to parse departments:', deptData);
                return data.departments;
            }
        };

        // Helper to update the chart
        const updateChart = () => {
            try {
                if (!charts.departmentTrends?.update) return;

                const activeTimeBtn = trendsWrapper.querySelector('.time-btn.active');
                const activeFilterBtn = trendsWrapper.querySelector('.filter-btn.active');

                const monthsToShow = activeTimeBtn 
                    ? getMonthsToShow(data.months, activeTimeBtn.dataset?.months || 'all')
                    : data.months;

                const selectedDepartments = activeFilterBtn
                    ? getDepartmentsFromButton(activeFilterBtn)
                    : data.departments;

                charts.departmentTrends.update(monthsToShow, selectedDepartments);
            } catch (e) {
                console.error('Error updating department trends chart:', e);
            }
        };

        // Setup time filter buttons
        trendsWrapper.querySelectorAll('.time-btn').forEach(button => {
            button.addEventListener('click', () => {
                trendsWrapper.querySelectorAll('.time-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
                updateChart();
            });
        });

        // Setup department filter buttons
        trendsWrapper.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', () => {
                trendsWrapper.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
                updateChart();
            });
        });

        // Initialize with default active buttons if none are active
        setTimeout(() => {
            if (!trendsWrapper.querySelector('.time-btn.active')) {
                const defaultTimeBtn = trendsWrapper.querySelector('.time-btn');
                if (defaultTimeBtn) defaultTimeBtn.classList.add('active');
            }

            if (!trendsWrapper.querySelector('.filter-btn.active')) {
                const defaultFilterBtn = trendsWrapper.querySelector('.filter-btn');
                if (defaultFilterBtn) defaultFilterBtn.classList.add('active');
            }

            updateChart();
        }, 100);
    } catch (e) {
        console.error('Error setting up department trends filters:', e);
    }
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
    const ctx = document.getElementById('department-trends-chart');
    if (!ctx) return null;

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `${context.dataset.label}: R$ ${context.raw.toLocaleString('pt-BR')}`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                    labels: { boxWidth: 12 }
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
        update: function(monthsToShow, selectedDepartments) {
            const filteredMonths = getMonthsToShow(monthsToShow, 'all');
            
            const datasets = selectedDepartments.map(dept => ({
                label: dept,
                data: filteredMonths.map(month => data[month]?.departments[dept]?.geral || 0),
                borderColor: colorsByDepartment[dept] || "#ccc",
                backgroundColor: 'transparent',
                borderWidth: 2,
                fill: false,
                tension: 0.3
            }));

            chart.data.labels = filteredMonths.map(formatMonthShort);
            chart.data.datasets = datasets;
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

    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [] },
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
                legend: { display: false }
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
        update: function(newData, monthsToShow, selectedDepartment = 'all') {
            // Filter data based on both time range and department
            const filteredMonths = getMonthsToShow(monthsToShow, 'all'); // We already filtered by time
            
            let datasets = [];
            if (selectedDepartment === 'all') {
                // Show total for all departments in the time range
                const totals = filteredMonths.map(month => {
                    const depts = newData[month]?.departments || {};
                    return Object.values(depts).reduce((sum, d) => sum + (d?.geral || 0), 0);
                });

                datasets.push({
                    label: 'Gastos Totais',
                    data: totals,
                    borderColor: '#024B59',
                    backgroundColor: hexToRGBA('#024B59', 0.1),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                });
            } else {
                // Show specific department in the time range
                const deptData = filteredMonths.map(month => 
                    newData[month]?.departments[selectedDepartment]?.geral || 0);
                
                const color = colorsByDepartment[selectedDepartment] || '#cccccc';
                
                datasets.push({
                    label: `Gastos - ${selectedDepartment}`,
                    data: deptData,
                    borderColor: color,
                    backgroundColor: hexToRGBA(color, 0.12),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                });
            }

            chart.data.labels = filteredMonths.map(formatMonthShort);
            chart.data.datasets = datasets;
            chart.update();
        }
    };
}

function initDashboard() {
    try {
        if (!data || !data.months || !data.departments || !data.data) {
            console.error('Invalid data structure:', data);
            showError('Dados inválidos recebidos do servidor');
            return;
        }

        const months = data.months;
        const departments = data.departments;

        // Initialize UI interactions first
        setupViewToggle();
        setupTimeFilters();
        setupDepartmentTrendsFilters();

        // Only initialize charts if their containers exist
        charts = {
            totalExpenditures: document.getElementById('total-expenditures-chart') ? 
                createTotalExpendituresChart(data.data, months, departments) : null,
            departmentBreakdown: document.getElementById('department-breakdown-charts') ? 
                createDepartmentBreakdownCharts(data.data, months, departments) : null,
            employeesChart: document.getElementById('employees-chart') ? 
                createEmployeesChart(data.data, months) : null,
            avgExpenditure: document.getElementById('avg-expenditure-chart') ? 
                createAvgExpenditureChart(data.data, months) : null,
            departmentTrends: document.getElementById('department-trends-chart') ? 
                createDepartmentTrendsChart(data.data, months, departments) : null,
            percentageStacked: document.getElementById('percentage-stacked-chart') ? 
                createPercentageStackedChart(data.data, months, departments) : null,
        };

        // Setup tables if the container exists
        if (document.getElementById('btn-summary-month')) {
            setupTableToggle();
            generateSummaryByMonth();
        }

        // Trigger default views safely
        setTimeout(() => {
            try {
                document.querySelector('#total-expenditures-wrapper .time-btn.active')?.click();
                document.querySelector('#department-trends-wrapper .time-btn.active')?.click();
            } catch (e) {
                console.error('Error triggering default views:', e);
            }
        }, 100);

    } catch (e) {
        console.error('Error initializing dashboard:', e);
        showError('Erro ao inicializar o dashboard');
    }
}

function showError(message) {
    const container = document.querySelector('.container') || document.body;
    container.innerHTML = `
        <div class="error-message">
            <h2>Erro</h2>
            <p>${message}</p>
            <button onclick="window.location.reload()">Recarregar</button>
        </div>
    `;
}



