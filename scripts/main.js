// Import necessary functions from the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Import view-specific modules
import { initExpensesView } from './expenses.js';
import { initEarningsView } from './earnings.js';
import { initTablesView } from './tables.js';
import { initEventsView } from './events.js';

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
const auth = getAuth(app);

// --- Global Variables & Shared State ---
export let data = { months: [], departments: [], data: {} };
export let charts = {};
let currentUserDocRef = null;

export const colorsByDepartment = {
    "Administrativo": "#6B5B95", "Apoio": "#FF6F61", "Comercial": "#E44D42",
    "Diretoria": "#0072B5", "Jurídico": "#2E8B57", "Marketing": "#FFA500",
    "NEC": "#9370DB", "Operação": "#00A86B", "RH": "#FF69B4",
    "Planejamento Estratégico": "#D95F02"
};
export const darkModeColors = {
    main: '#0DEB89'
};

export const globalChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
        duration: 800
    }
};

// --- Utility Functions ---
export function hexToRGBA(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatMonthLabel(monthStr) {
    if (!monthStr || !monthStr.includes('-')) return "Invalid Date";
    const [year, month] = monthStr.split("-");
    const monthsPt = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${monthsPt[parseInt(month) - 1]}/${year}`;
}

export function formatMonthShort(monthStr) {
    if (!monthStr || !monthStr.includes('-')) return "";
    const [year, month] = monthStr.split("-");
    return `${month}/${year.slice(2)}`;
}

export function formatCurrencyBRL(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatVA(value, month) {
    if (month < '2025-01' && (value === 0 || value === null || value === undefined)) {
        return 'N/A';
    }
    return formatCurrencyBRL(value);
}

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

// --- DOM Elements ---
const loadingView = document.getElementById('loading-view');
const dashboardWrapper = document.getElementById('dashboard-wrapper');
const logoutBtn = document.getElementById("logout-btn");
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebar = document.getElementById('sidebar-nav');
const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

// --- Main Application Flow ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await checkAuthorization(user);
    } else {
        currentUserDocRef = null;
        window.location.href = '/login.html';
    }
});

async function checkAuthorization(user) {
    try {
        const q = query(collection(db, "authorizedUsers"), where("email", "==", user.email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            currentUserDocRef = userDoc.ref;
            const userData = userDoc.data();

            const userAvatar = document.getElementById('user-avatar-img');
            const userNameDisplay = document.getElementById('user-name-display');
            const userRoleDisplay = document.getElementById('user-role-display');
            
            userNameDisplay.textContent = user.displayName || 'Usuário';
            if (user.photoURL) {
                userAvatar.src = user.photoURL;
            }
            if (userData.role) {
                userRoleDisplay.textContent = userData.role;
                userRoleDisplay.style.display = 'block';
            } else {
                 userNameDisplay.style.lineHeight = '2.5rem'; // Center name vertically if no role
            }

            if (userData.theme === 'dark') {
                document.body.classList.add('dark');
                sunIcon.classList.add('hidden');
                moonIcon.classList.remove('hidden');
            } else {
                document.body.classList.remove('dark');
                sunIcon.classList.remove('hidden');
                moonIcon.classList.add('hidden');
            }
            
            await loadDashboardData();
            loadingView.style.display = 'none';
            dashboardWrapper.style.display = 'flex';
        } else {
            alert(`A conta ${user.email} não tem permissão de acesso.`);
            await signOut(auth);
        }
    } catch (error) {
        console.error("Authorization check error:", error);
        alert("Erro ao verificar permissão. Tente novamente.");
        await signOut(auth);
    }
}

async function loadDashboardData() {
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
        
        data.months = Array.from(monthsSet).sort();
        data.departments = Array.from(departmentsSet).sort();
        data.data = structuredData;

        initDashboard();

    } catch (error) {
        console.error("Error loading data from Firestore:", error);
        showError(`Falha ao carregar os dados: ${error.message}`);
    }
}

function updateChartTheme() {
    const isDarkMode = document.body.classList.contains('dark');
    const fontColor = isDarkMode ? 'rgba(255, 255, 255, 0.8)' : '#333';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const mainLineColor = isDarkMode ? darkModeColors.main : '#024B59';

    Chart.defaults.color = fontColor;
    
    Object.values(charts).forEach(chartInstance => {
        if (chartInstance && chartInstance.options) {
            if (chartInstance.options.scales) {
                Object.keys(chartInstance.options.scales).forEach(axis => {
                    chartInstance.options.scales[axis].ticks.color = fontColor;
                    chartInstance.options.scales[axis].grid.color = gridColor;
                });
            }
            if (chartInstance.options.plugins && chartInstance.options.plugins.legend) {
                chartInstance.options.plugins.legend.labels.color = fontColor;
            }
            chartInstance.data.datasets.forEach(dataset => {
                if (dataset.isMainLine) {
                    dataset.borderColor = mainLineColor;
                    dataset.backgroundColor = hexToRGBA(mainLineColor, 0.1);
                    dataset.pointBackgroundColor = mainLineColor;
                }
                 if (dataset.isNetProfit) {
                    dataset.backgroundColor = dataset.data.map(val => val >= 0 ? mainLineColor : '#E44D42');
                }
            });
            chartInstance.update();
        }
    });
}


function initDashboard() {
    setupSidebar();
    
    initExpensesView();
    initEarningsView();
    initTablesView();
    initEventsView();
    
    updateChartTheme();

    document.querySelector('#nav-list .nav-link')?.click();
}

function setupSidebar() {
    const navList = document.getElementById('nav-list');
    const viewTitle = document.getElementById('view-title');
    const views = document.querySelectorAll('#views-container > div');

    const navLinksConfig = [
        { id: 'btn-expenses-main', text: 'Gastos', viewId: 'charts-view', icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`, roles: ['admin', 'finance'] },
        { id: 'btn-earnings-main', text: 'Faturamento', viewId: 'earnings-view', icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>`, roles: ['admin', 'finance'] },
        { id: 'btn-tables-main', text: 'Tabelas', viewId: 'tables-view', icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`, roles: ['admin'] },
        { id: 'btn-events-main', text: 'Eventos', viewId: 'events-view-content', icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`, roles: ['admin', 'hr', 'finance'] }
    ];
    let currentUserRole = 'admin';

    navList.innerHTML = ''; 
    const filteredLinks = navLinksConfig.filter(link => link.roles.includes(currentUserRole));
    filteredLinks.forEach(link => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="#" id="${link.id}" data-view="${link.viewId}" class="nav-link">${link.icon}<span class="nav-text">${link.text}</span></a>`;
        navList.appendChild(li);
    });

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const viewId = link.dataset.view;
            const linkConfig = navLinksConfig.find(c => c.viewId === viewId);
            
            views.forEach(view => view.style.display = view.id === viewId ? 'flex' : 'none');
            
            if (linkConfig) {
                 document.getElementById('view-title-main').textContent = linkConfig.text;
            }

            if (viewId === 'tables-view') {
                const activeTableButton = document.querySelector('.table-toggle-btn.active');
                if (!activeTableButton) {
                    document.getElementById('btn-summary-month')?.click();
                }
            }
        });
    });

    hamburgerBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        setTimeout(() => {
            Object.values(charts).forEach(chartInstance => {
                if (chartInstance && typeof chartInstance.resize === 'function') {
                    chartInstance.resize();
                }
            });
        }, 350); 
    });

    themeToggle.addEventListener('click', async () => {
        document.body.classList.toggle('dark');
        sunIcon.classList.toggle('hidden');
        moonIcon.classList.toggle('hidden');
        updateChartTheme();

        if (currentUserDocRef) {
            const newTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
            try {
                await setDoc(currentUserDocRef, { theme: newTheme }, { merge: true });
            } catch (error) {
                console.error("Error saving theme preference:", error);
            }
        }
    });
}

function showError(message) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.innerHTML = `<div class="error-message"><h2>Erro</h2><p>${message}</p><button onclick="window.location.reload()">Recarregar Página</button></div>`;
    }
    loadingView.style.display = 'none';
    dashboardWrapper.style.display = 'flex';
}

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
});
