// scripts/payslip.js

// Using the latest modular Firebase SDK for better performance and tree-shaking.
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app } from './main.js';

// --- IMPORTANT: PASTE YOUR GEMINI API KEY HERE FOR DEVELOPMENT ---
const GEMINI_API_KEY = "AIzaSyBaM10J2fS0Zxa3GoL-DrCxyLFXYpeVeig";

// --- Default Hardcoded Rules ---
let ruleMappings = {
    comissao: [37, 853],
    valeAdiantamento: [981],
    vtDesconto: [48],
    salarioFamilia: [995],
    descontoEmprestimo: [9750],
    horasExtrasValor: [250, 150],
    descontoFaltas: [8069, 42, 40]
};

// --- Module State ---
let db;
let tsvFile = null;
let pdfFiles = [];
let nameList = [];
let payslipData = new Map();
let newFoundCodes = new Map();
let ignoredCodes = new Set([
    // Pre-loaded ignored codes from the TSV file
    1, 998, 8697, 8699, 5, 896, 931, 805, 806, 937, 812, 821, 848, 8504, 999, 4, 894, 100, 843
].map(String));

const BATCH_SIZE = 10;
const DB_CONFIG_PATH = "payslipProcessor/config"; // Single doc for all config

// --- DOM Elements ---
let tsvInput, pdfInput, processBtn, resetBtn, tsvIndicator, pdfIndicator, loader, loaderText, outputSection, warningSection, warningList, downloadBtn, tsvDropArea, pdfDropArea, progressBar, ruleConfigSection, ruleConfigList, addRuleBtn, saveRulesBtn, ruleCategorySelect, ruleCodeInput, outputTable, outputTableBody;

/**
 * Initializes the payslip processor module.
 */
export function initPayslipProcessor() {
    if (!app) {
        console.error("Firebase app is not initialized.");
        showError("Critical Error: Firebase connection failed.");
        return;
    }
    db = getFirestore(app);
    cacheDomElements();
    if (!processBtn) return;
    bindEventListeners();
    fetchConfigFromDb(); // Fetch both rules and ignored codes
    renderRuleConfig();
    console.log("Payslip Processor Initialized");
}

/**
 * Caches all necessary DOM elements for the module.
 */
function cacheDomElements() {
    tsvInput = document.getElementById('payslip-tsv-upload');
    pdfInput = document.getElementById('payslip-pdf-upload');
    processBtn = document.getElementById('payslip-process-btn');
    resetBtn = document.getElementById('payslip-reset-btn');
    tsvIndicator = document.getElementById('tsv-file-indicator');
    pdfIndicator = document.getElementById('pdf-file-indicator');
    loader = document.getElementById('payslip-loader');
    loaderText = document.getElementById('payslip-loader-text');
    progressBar = document.getElementById('payslip-progress-bar');
    outputSection = document.getElementById('payslip-output-section');
    warningSection = document.getElementById('payslip-warning-section');
    warningList = document.getElementById('payslip-warning-list');
    downloadBtn = document.getElementById('payslip-download-btn');
    tsvDropArea = document.getElementById('tsv-drop-area');
    pdfDropArea = document.getElementById('pdf-drop-area');
    ruleConfigSection = document.getElementById('rule-config-section');
    ruleConfigList = document.getElementById('rule-config-list');
    addRuleBtn = document.getElementById('add-rule-btn');
    saveRulesBtn = document.getElementById('save-rules-btn');
    ruleCategorySelect = document.getElementById('rule-category-select');
    ruleCodeInput = document.getElementById('rule-code-input');
    outputTable = document.getElementById('payslip-output-table');
    outputTableBody = document.getElementById('payslip-output-table-body');
}

/**
 * Binds all event listeners for the module.
 */
function bindEventListeners() {
    if(tsvInput) tsvInput.addEventListener('change', (e) => handleTsvSelect(e.target.files));
    if(pdfInput) pdfInput.addEventListener('change', (e) => handlePdfSelect(e.target.files));
    if(tsvDropArea) setupDragDrop(tsvDropArea, handleTsvSelect);
    if(pdfDropArea) setupDragDrop(pdfDropArea, handlePdfSelect);
    if(processBtn) processBtn.addEventListener('click', handleProcessing);
    if(resetBtn) resetBtn.addEventListener('click', resetProcess);
    if(warningSection) warningSection.addEventListener('click', handleIgnoreClick);
    if(downloadBtn) downloadBtn.addEventListener('click', downloadTsv);
    if(addRuleBtn) addRuleBtn.addEventListener('click', addRule);
    if(saveRulesBtn) saveRulesBtn.addEventListener('click', saveConfigToDb);
}


/**
 * Resets the entire process and UI to its initial state.
 */
function resetProcess() {
    tsvFile = null;
    pdfFiles = [];
    if(tsvInput) tsvInput.value = '';
    if(pdfInput) pdfInput.value = '';
    payslipData.clear();
    newFoundCodes.clear();
    if(tsvIndicator) tsvIndicator.textContent = "Nenhum arquivo selecionado.";
    if(pdfIndicator) pdfIndicator.textContent = "Nenhum arquivo selecionado.";
    if(outputSection) outputSection.style.display = 'none';
    if(warningSection) warningSection.style.display = 'none';
    if(outputTableBody) outputTableBody.innerHTML = '';
    if(warningList) warningList.innerHTML = '';
    showError('');
    showLoader(false);
    checkProcessButtonState();
    console.log("Process has been reset.");
}

function setupDragDrop(area, fileHandler) {
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('bg-blue-100', 'border-blue-400'); });
    area.addEventListener('dragleave', () => area.classList.remove('bg-blue-100', 'border-blue-400'));
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('bg-blue-100', 'border-blue-400');
        if (e.dataTransfer.files.length > 0) fileHandler(e.dataTransfer.files);
    });
}

function handleTsvSelect(files) {
    tsvFile = files[0] || null;
    tsvIndicator.textContent = tsvFile ? tsvFile.name : "Nenhum arquivo selecionado.";
    checkProcessButtonState();
}

function handlePdfSelect(files) {
    pdfFiles = Array.from(files);
    pdfIndicator.textContent = pdfFiles.length > 0 ? `${pdfFiles.length} PDF(s) selecionado(s).` : "Nenhum arquivo selecionado.";
    checkProcessButtonState();
}

function checkProcessButtonState() {
    if(processBtn) processBtn.disabled = pdfFiles.length === 0;
}

async function fetchConfigFromDb() {
    if (!db) return;
    try {
        const docRef = doc(db, DB_CONFIG_PATH);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const config = docSnap.data();
            if (config.ruleMappings) {
                ruleMappings = config.ruleMappings;
                console.log("Fetched custom rules from DB.");
            }
            if (config.ignoredCodes) {
                config.ignoredCodes.forEach(code => ignoredCodes.add(String(code)));
                console.log("Fetched and merged ignored codes.");
            }
            renderRuleConfig(); // Re-render the UI with the fetched rules
        }
    } catch (err) {
        console.error("Error fetching config:", err);
        showError("Could not fetch config from Firebase.");
    }
}

async function saveConfigToDb() {
    if (!db) {
        console.error("Firestore DB not initialized.");
        return;
    }
    try {
        const docRef = doc(db, DB_CONFIG_PATH);
        const config = {
            ruleMappings: ruleMappings,
            ignoredCodes: Array.from(ignoredCodes)
        };
        await setDoc(docRef, config);
        alert("Regras salvas com sucesso!"); // Using alert for simple confirmation
    } catch (err) {
        console.error("Error saving config:", err);
        showError(`Could not save config to Firebase: ${err.message}.`);
    }
}

async function handleProcessing() {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
        showError("Please add your Gemini API Key to the payslip.js file.");
        return;
    }

    showLoader(true, `Starting processing...`, 0);
    processBtn.disabled = true;
    if (resetBtn) resetBtn.disabled = true;
    showError('');
    outputSection.style.display = 'none';
    warningSection.style.display = 'none';
    newFoundCodes.clear();
    payslipData.clear();

    try {
        if (tsvFile) {
            const namesText = await tsvFile.text();
            nameList = namesText.split('\n').map(n => n.trim()).filter(Boolean);
        } else {
            nameList = [];
        }

        let processedCount = 0;
        for (const pdf of pdfFiles) {
            processedCount++;
            const progress = (processedCount / pdfFiles.length) * 100;
            showLoader(true, `Processing file ${processedCount} of ${pdfFiles.length}...`, progress);
            
            if (pdf.size === 0) {
                console.warn(`Skipping empty file: ${pdf.name}`);
                continue;
            }
            try {
                const dataMap = await processPdf(pdf);
                dataMap.forEach((value, key) => payslipData.set(key, value));
            } catch (pdfError) {
                 console.error(`Failed to process ${pdf.name}. Skipping.`, pdfError);
                 showError(`An error occurred while processing ${pdf.name}. It has been skipped.`);
            }
            // Safety save after each file
            renderResults();
        }
        
    } catch (err) {
        console.error("File processing error:", err);
        showError(`An error occurred: ${err.message}`);
    } finally {
        showLoader(false);
        checkProcessButtonState();
        if(resetBtn) resetBtn.disabled = false;
        console.log("All processing finished.");
    }
}

async function processPdf(file) {
    const base64File = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    const prompt = `
        Analyze the provided PDF of a payslip. The table has columns: 'Código', 'Descrição', 'Referência', 'Vencimentos', and 'Descontos'.
        It is CRITICAL that you correctly associate values from 'Vencimentos' and 'Descontos' with their corresponding 'Descrição' on the same line.
        Pay close attention to vertical alignment. A value in the 'Descontos' column belongs to the 'Descrição' on its immediate left, even if there are large empty spaces or other values above or below it.
        For example, if you see 'I.N.S.S.' in the 'Descrição' column, the value '138,82' far to its right in the 'Descontos' column is associated with it.
        Extract all line items.
        Return a single JSON object with two keys: "employeeName" (the employee's full name in uppercase) and "lineItems" (an array of the extracted line items).
        Return ONLY the raw JSON object, without any markdown formatting.
    `;

    const payload = {
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: base64File } }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    employeeName: { type: "STRING" },
                    lineItems: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                codigo: { type: "NUMBER" },
                                descricao: { type: "STRING" },
                                vencimentos: { type: "NUMBER" },
                                descontos: { type: "NUMBER" }
                            },
                            required: ["codigo", "descricao", "vencimentos", "descontos"]
                        }
                    }
                },
                required: ["employeeName", "lineItems"]
            }
        }
    };

    const resultText = await makeApiCallWithRetry(payload);
    const parsedResult = JSON.parse(resultText);
    
    const normalizedMap = new Map();
    if (parsedResult.employeeName && parsedResult.lineItems) {
        const name = parsedResult.employeeName.toUpperCase().trim();
        normalizedMap.set(name, parsedResult.lineItems);
    } else {
        console.warn("Parsed result was missing expected fields", parsedResult);
    }
    return normalizedMap;
}

async function makeApiCallWithRetry(payload, maxRetries = 3) {
    const model = "gemini-1.5-flash-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ error: { message: 'Could not parse error response.' } }));
                throw new Error(`API request failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
            }
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                return result.candidates[0].content.parts[0].text;
            } else {
                throw new Error("Invalid or empty response structure from API.");
            }
        } catch (error) {
            console.warn(`API call attempt ${i + 1} failed. Retrying in ${delay / 1000}s...`, error.message);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
    throw new Error("API call failed after multiple retries.");
}

function renderResults() {
    const headers = ["Nome", "Comissão", "Vale Adiantamento", "VT Desconto", "Salário Família", "Desconto Empréstimo", "Horas Extras", "Desconto Faltas"];
    
    // Clear previous results
    if(outputTable) outputTable.querySelector('thead').innerHTML = `<tr>${headers.map(h => `<th scope="col" class="px-6 py-3">${h}</th>`).join('')}</tr>`;
    if(outputTableBody) outputTableBody.innerHTML = '';

    const foundCodes = new Map();
    const namesToProcess = nameList.length > 0 ? nameList : Array.from(payslipData.keys()).sort();
    
    const codeToCategory = new Map();
    for (const category in ruleMappings) {
        ruleMappings[category].forEach(code => codeToCategory.set(String(code), category));
    }

    namesToProcess.forEach(name => {
        const personData = payslipData.get(name.toUpperCase().trim());
        let rowData = { comissao: 0, valeAdiantamento: 0, vtDesconto: 0, salarioFamilia: 0, descontoEmprestimo: 0, horasExtrasValor: 0, descontoFaltas: 0 };

        if (personData) {
            personData.forEach(item => {
                const codigoStr = String(item.codigo || 0);
                const category = codeToCategory.get(codigoStr);
                
                if (category) {
                    rowData[category] += (item.vencimentos > 0 ? item.vencimentos : item.descontos);
                } else if (!ignoredCodes.has(codigoStr) && (item.vencimentos > 0 || item.descontos > 0)) {
                    if (!foundCodes.has(item.codigo)) foundCodes.set(item.codigo, item.descricao);
                }
            });
        }

        const newRow = outputTableBody.insertRow();
        newRow.className = "bg-white border-b";
        newRow.insertCell().textContent = name;
        Object.keys(rowData).forEach(key => {
            const cell = newRow.insertCell();
            cell.textContent = (rowData[key] === 0 ? '0,00' : rowData[key].toFixed(2).replace('.', ','));
            cell.setAttribute('contenteditable', 'true');
            cell.className = "px-6 py-4";
        });
    });

    newFoundCodes = foundCodes;
    
    if (payslipData.size > 0) {
        outputSection.style.display = 'block';
    }

    if (newFoundCodes.size > 0) {
        displayWarnings();
    } else {
        warningSection.style.display = 'none';
    }
}

function displayWarnings() {
    warningList.innerHTML = '';
    if (newFoundCodes.size === 0) {
        warningSection.style.display = 'none';
        return;
    }
    newFoundCodes.forEach((desc, code) => {
        const warningEl = document.createElement('div');
        warningEl.className = 'flex items-center justify-between text-sm py-2 px-3 bg-gray-50 rounded-md shadow-sm';
        warningEl.innerHTML = `
            <span class="truncate pr-4"><strong class="font-semibold text-gray-800">Code ${code}:</strong> <span class="text-gray-600">${desc}</span></span>
            <button data-code="${code}" class="ignore-btn dev-btn btn-tertiary">Ignore</button>`;
        warningList.appendChild(warningEl);
    });
    warningSection.style.display = 'block';
}

function handleIgnoreClick(event) {
    if (!event.target.classList.contains('ignore-btn')) return;
    const codeToIgnore = event.target.dataset.code;
    
    ignoredCodes.add(String(codeToIgnore));
    saveConfigToDb(); // Save ignored codes immediately
    newFoundCodes.delete(Number(codeToIgnore));
    renderResults();
}

function downloadTsv() {
    const headers = ["Nome", "Comissão", "Vale Adiantamento", "VT Desconto", "Salário Família", "Desconto Empréstimo", "Horas Extras", "Desconto Faltas"];
    let tsvContent = headers.join('\t') + '\n';

    outputTableBody.querySelectorAll('tr').forEach(row => {
        const rowData = Array.from(row.querySelectorAll('td')).map(td => td.textContent);
        tsvContent += rowData.join('\t') + '\n';
    });
    
    if (!tsvContent) return;
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "folhas_processadas.tsv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showLoader(show, message = 'Processing...', progress = 0) {
    if (loaderText) loaderText.textContent = message;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const errorEl = document.getElementById('payslip-error');
    if(errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = message ? 'block' : 'none';
    }
}

// --- Rule Configuration UI Functions ---
function renderRuleConfig() {
    if (!ruleConfigList) return;
    ruleConfigList.innerHTML = '';
    for (const category in ruleMappings) {
        const categoryName = ruleCategorySelect.querySelector(`option[value=${category}]`).textContent;
        ruleMappings[category].forEach(code => {
            const ruleEl = document.createElement('div');
            ruleEl.className = 'flex items-center justify-between text-sm p-2 bg-gray-50 rounded';
            ruleEl.innerHTML = `<span><strong class="font-semibold">${categoryName}:</strong> Code ${code}</span>
                              <button data-code="${code}" data-category="${category}" class="remove-rule-btn text-red-500 hover:text-red-700">Remove</button>`;
            ruleConfigList.appendChild(ruleEl);
        });
    }
    // Add event listeners to the new remove buttons
    ruleConfigList.querySelectorAll('.remove-rule-btn').forEach(btn => {
        btn.addEventListener('click', removeRule);
    });
}

function addRule() {
    const category = ruleCategorySelect.value;
    const code = Number(ruleCodeInput.value);
    if (!category || !code) {
        alert("Please select a category and enter a code.");
        return;
    }
    if (!ruleMappings[category]) {
        ruleMappings[category] = [];
    }
    if (!ruleMappings[category].includes(code)) {
        ruleMappings[category].push(code);
    }
    ruleCodeInput.value = '';
    renderRuleConfig();
}

function removeRule(event) {
    const { code, category } = event.target.dataset;
    const codeNum = Number(code);
    if (ruleMappings[category]) {
        ruleMappings[category] = ruleMappings[category].filter(c => c !== codeNum);
    }
    renderRuleConfig();
}
