// Import necessary functions from the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Import view-specific modules
import { initExpensesView } from './expenses.js';
import { initEarningsView } from './earnings.js';
import { initTablesView } from './tables.js';
import { initDevView } from './dev.js'; // Import the new dev module

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

export const colorsByDepartment = {
    "Administrativo": "#6B5B95", "Apoio": "#FF6F61", "Comercial": "#E44D42",
    "Diretoria": "#0072B5", "Jurídico": "#2E8B57", "Marketing": "#FFA500",
    "NEC": "#9370DB", "Operação": "#00A86B", "RH": "#FF69B4",
    "Planejamento Estratégico": "#D95F02"
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

// --- Main Application Flow ---

document.addEventListener('DOMContentLoaded', () => {
    const loadingView = document.getElementById('loading-view');
    const dashboardContainer = document.querySelector('.container');
    const logoutBtn = document.getElementById("logout-btn");
    const devBtn = document.getElementById("btn-dev-main");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await checkAuthorization(user);
        } else {
            window.location.href = '/login.html';
        }
    });

    async function checkAuthorization(user) {
        try {
            const q = query(collection(db, "authorizedUsers"), where("email", "==", user.email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();

                if (userData.type === 'admin') {
                    devBtn.style.display = 'block';
                }
                
                await loadDashboardData();
                loadingView.style.display = 'none';
                dashboardContainer.style.display = 'block';
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

    function initDashboard() {
        setupViewToggle();
        
        initExpensesView();
        initEarningsView();
        initTablesView();
        initDevView(); // Initialize the new dev view

        const summaryMonthBtn = document.getElementById('btn-summary-month');
        if(summaryMonthBtn) {
            summaryMonthBtn.click();
        }
    }

    function setupViewToggle() {
        const container = document.querySelector('.view-toggle');
        const buttons = container.querySelectorAll('button:not(#logout-btn)');
        const views = {
            'btn-expenses-main': 'charts-view',
            'btn-earnings-main': 'earnings-view',
            'btn-tables-main': 'tables-view',
            'btn-dev-main': 'dev-view' // Updated view mapping
        };

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                buttons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const viewId = views[button.id];

                Object.values(views).forEach(id => {
                    const viewEl = document.getElementById(id);
                    if (viewEl) viewEl.style.display = 'none';
                });

                const viewEl = document.getElementById(viewId);
                if (viewEl) viewEl.style.display = (viewId === 'dev-view') ? 'block' : 'flex';

                if (viewId === 'tables-view' && !document.querySelector('.table-toggle-btn.active')) {
                     const summaryMonthBtn = document.getElementById('btn-summary-month');
                     if(summaryMonthBtn) {
                        summaryMonthBtn.click();
                     }
                }
            });
        });
    }

    function showError(message) {
        dashboardContainer.innerHTML = `<div class="error-message"><h2>Erro</h2><p>${message}</p><button onclick="window.location.reload()">Recarregar Página</button></div>`;
        dashboardContainer.style.display = 'block';
        loadingView.style.display = 'none';
    }

    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
    });
});
