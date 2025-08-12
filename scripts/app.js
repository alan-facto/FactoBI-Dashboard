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
  if (!legendContainer) return;
  
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
  if (!container) return;
  
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

// FIXED: Corrigindo a lógica dos filtros para trabalhar em conjunto
function setupTimeFilters() {
    // Total Expenditures Chart - Filtros de tempo e departamento trabalham juntos
    document.querySelectorAll('#total-expenditures-wrapper .time-btn').forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all time buttons in this chart
            document.querySelectorAll('#total-expenditures-wrapper .time-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Get current active department filter
            const activeDepartmentBtn = document.querySelector('#total-expenditures-wrapper .filter-btn:not(.time-btn).active');
            const activeDepartment = activeDepartmentBtn ? activeDepartmentBtn.dataset.department : 'all';
            
            // Get months to show based on selected time range
            const monthsToShow = getMonthsToShow(data.months, button.dataset.months);
            
            // Update chart with both filters
            if (charts["total-expenditures-chart"]) {
                charts["total-expenditures-chart"].update(data.data, monthsToShow, activeDepartment);
            }
        });
    });

    // Total Expenditures Chart - Department filters
    document.querySelectorAll('#total-expenditures-wrapper .filter-btn:not(.time-btn)').forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all department buttons in this chart
            document.querySelectorAll('#total-expenditures-wrapper .filter-btn:not(.time-btn)').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Get current active time filter
            const activeTimeBtn = document.querySelector('#total-expenditures-wrapper .time-btn.active');
            const timeRange = activeTimeBtn ? activeTimeBtn.dataset.months : '12';
            
            // Get months to show based on selected time range
            const monthsToShow = getMonthsToShow(data.months, timeRange);
            
            // Update chart with both filters
            if (charts["total-expenditures-chart"]) {
                charts["total-expenditures-chart"].update(data.data, monthsToShow, button.dataset.department);
            }
        });
    });

    // Department Trends Chart - Time filters
    document.querySelectorAll('#department-trends-wrapper .time-btn').forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all time buttons in this chart
            document.querySelectorAll('#department-trends-wrapper .time-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Get current active department group filter
            const activeDeptGroupBtn = document.querySelector('#department-trends-wrapper .filter-btn:not(.time-btn).active');
            const activeDeptGroup = activeDeptGroupBtn ? activeDeptGroupBtn.dataset.departments : 'all';
            
            // Get months to show based on selected time range
            const monthsToShow = getMonthsToShow(data.months, button.dataset.months);
            
            // Parse department groups
            const departmentsToShow = tryParseJSON(activeDeptGroup);
            
            // Update chart with both filters
            if (charts["department-trends-chart"]) {
                charts["department-trends-chart"].update(data.data, monthsToShow, departmentsToShow);
            }
        });
    });

    // Department Trends Chart - Department group filters
    document.querySelectorAll('#department-trends-wrapper .filter-btn:not(.time-btn)').forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all department group buttons in this chart
            document.querySelectorAll('#department-trends-wrapper .filter-btn:not(.time-btn)').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Get current active time filter
            const activeTimeBtn = document.querySelector('#department-trends-wrapper .time-btn.active');
            const timeRange = activeTimeBtn ? activeTimeBtn.dataset.months : '12';
            
            // Get months to show based on selected time range
            const monthsToShow = getMonthsToShow(data.months, timeRange);
            
            // Parse department groups
            const departmentsToShow = tryParseJSON(button.dataset.departments);
            
            // Update chart with both filters
            if (charts["department-trends-chart"]) {
                charts["department-trends-chart"].update(data.data, monthsToShow, departmentsToShow);
            }
        });
    });
}

function setupDepartmentFilters() {
    // This function is now integrated into setupTimeFilters above
    // Keeping it for compatibility but it's no longer needed
}

// Chart creation classes - FROM NEW FILES
class TotalExpendituresChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.chart = null;
    }

    update(dataObj, monthsToShow, selectedDepartment = 'all') {
        const labels = monthsToShow.map(formatMonthShort);
        let chartData;

        if (selectedDepartment === 'all') {
            // Show total expenditures across all departments
            chartData = monthsToShow.map(month => dataObj[month]?.total || 0);
        } else {
            // Show expenditures for specific department
            chartData = monthsToShow.map(month => dataObj[month]?.departments[selectedDepartment]?.geral || 0);
        }

        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: selectedDepartment === 'all' ? 'Total Geral' : selectedDepartment,
                    data: chartData,
                    borderColor: selectedDepartment === 'all' ? '#0072B5' : (colorsByDepartment[selectedDepartment] || '#0072B5'),
                    backgroundColor: selectedDepartment === 'all' ? 'rgba(0, 114, 181, 0.1)' : hexToRGBA(colorsByDepartment[selectedDepartment] || '#0072B5', 0.1),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: selectedDepartment === 'all' ? '#0072B5' : (colorsByDepartment[selectedDepartment] || '#0072B5'),
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatCurrencyBRL(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrencyBRL(value);
                            }
                        }
                    }
                }
            }
        };

        if (this.chart) {
            this.chart.destroy();
        }
        this.chart = new Chart(this.ctx, config);
    }
}

class DepartmentTrendsChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.chart = null;
    }

    update(dataObj, monthsToShow, departmentsToShow = []) {
        const labels = monthsToShow.map(formatMonthShort);
        
        // If departmentsToShow is empty or 'all', show all departments
        const depts = departmentsToShow.length > 0 ? departmentsToShow : data.departments;
        
        const datasets = depts.map(dept => ({
            label: dept,
            data: monthsToShow.map(month => dataObj[month]?.departments[dept]?.geral || 0),
            borderColor: colorsByDepartment[dept] || '#ccc',
            backgroundColor: hexToRGBA(colorsByDepartment[dept] || '#ccc', 0.1),
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            pointBackgroundColor: colorsByDepartment[dept] || '#ccc',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4
        }));

        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatCurrencyBRL(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrencyBRL(value);
                            }
                        }
                    }
                }
            }
        };

        if (this.chart) {
            this.chart.destroy();
        }
        this.chart = new Chart(this.ctx, config);
    }
}

class PercentageStackedChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.chart = null;
    }

    update(dataObj, monthsToShow) {
        const labels = monthsToShow.map(formatMonthShort);
        
        const datasets = data.departments.map(dept => ({
            label: dept,
            data: monthsToShow.map(month => {
                const monthData = dataObj[month];
                if (!monthData || monthData.total === 0) return 0;
                const deptValue = monthData.departments[dept]?.geral || 0;
                return (deptValue / monthData.total) * 100;
            }),
            backgroundColor: colorsByDepartment[dept] || '#ccc'
        }));

        const config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        };

        if (this.chart) {
            this.chart.destroy();
        }
        this.chart = new Chart(this.ctx, config);
    }
}

// Chart creation classes - FROM OLD FILES
class AvgExpenditureChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.chart = null;
    }

    update(dataObj, monthsToShow) {
        const labels = monthsToShow.map(formatMonthShort);
        const avgData = monthsToShow.map(month => {
            const monthData = dataObj[month];
            if (!monthData || monthData.totalEmployees === 0) return 0;
            return monthData.total / monthData.totalEmployees;
        });

        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Média de Gastos por Funcionário',
                    data: avgData,
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
                    legend: { display: false }
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
        };

        if (this.chart) {
            this.chart.destroy();
        }
        this.chart = new Chart(this.ctx, config);
    }
}

class EmployeesChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.chart = null;
    }

    update(dataObj, monthsToShow) {
        const labels = monthsToShow.map(formatMonthShort);
        const employeeData = monthsToShow.map(month => dataObj[month]?.totalEmployees || 0);

        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total de Funcionários',
                    data: employeeData,
                    borderColor: '#2E8B57',
                    backgroundColor: 'rgba(46, 139, 87, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#2E8B57',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Funcionários: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        };

        if (this.chart) {
            this.chart.destroy();
        }
        this.chart = new Chart(this.ctx, config);
    }
}

function createDepartmentBreakdownCharts(dataObj, monthsToShow) {
    const container = document.getElementById("department-breakdown-charts");
    if (!container) return;
    
    // Clear previous charts and canvases to prevent memory leaks and recursion
    container.innerHTML = '';

    // Use last 6 months for breakdown
    const last6Months = data.months.slice(-6);
    
    last6Months.forEach(month => {
        const monthData = dataObj[month];
        if (!monthData) return;

        const chartDiv = document.createElement("div");
        chartDiv.className = "breakdown-chart";
        
        const title = document.createElement("h4");
        title.textContent = formatMonthLabel(month);
        chartDiv.appendChild(title);

        const canvas = document.createElement("canvas");
        canvas.id = `breakdown-${month}`;
        chartDiv.appendChild(canvas);
        
        container.appendChild(chartDiv);

        // Create pie chart for this month
        const ctx = canvas.getContext("2d");
        const deptData = Object.entries(monthData.departments).map(([dept, data]) => ({
            label: dept,
            value: data.geral,
            color: colorsByDepartment[dept] || '#ccc'
        }));

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: deptData.map(d => d.label),
                datasets: [{
                    data: deptData.map(d => d.value),
                    backgroundColor: deptData.map(d => d.color),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(1);
                                return `${context.label}: ${formatCurrencyBRL(context.raw)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    });

    // Generate legend
    generateDepartmentLegend(data.departments, colorsByDepartment);
}

function initDashboard() {
    console.log('Initializing dashboard with data:', data);
    
    // Create chart instances - combining from both files
    charts["total-expenditures-chart"] = new TotalExpendituresChart("total-expenditures-chart");
    charts["department-trends-chart"] = new DepartmentTrendsChart("department-trends-chart");
    charts["percentage-stacked-chart"] = new PercentageStackedChart("percentage-stacked-chart");
    charts["avg-expenditure-chart"] = new AvgExpenditureChart("avg-expenditure-chart");
    charts["employees-chart"] = new EmployeesChart("employees-chart");

    // FIXED: Set correct default values and update charts
    const defaultMonths = data.months.slice(-12); // Last 12 months
    
    // Update all charts with default values
    charts["total-expenditures-chart"].update(data.data, defaultMonths, 'all');
    charts["department-trends-chart"].update(data.data, defaultMonths, data.departments); // Show all departments
    charts["percentage-stacked-chart"].update(data.data, defaultMonths);
    charts["avg-expenditure-chart"].update(data.data, defaultMonths);
    charts["employees-chart"].update(data.data, defaultMonths);
    
    // Create department breakdown charts
    createDepartmentBreakdownCharts(data.data, defaultMonths);

    // Setup event listeners
    setupTimeFilters();
    setupViewToggle();
    setupTableToggle();

    console.log('Dashboard initialized successfully');
}

