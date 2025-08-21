// scripts/payslip.js

// Using the latest modular Firebase SDK for better performance and tree-shaking.
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app } from './main.js';

// --- API Key for Development ---
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
    1, 998, 8697, 8699, 5, 896, 931, 805, 806, 937, 812, 821, 848, 8504, 999, 4, 894, 100, 843
].map(String));

// --- CONFIGURATION ---
const BATCH_SIZE = 10; // Increased batch size for the faster Flash-Lite model.
const DB_CONFIG_PATH = "payslipProcessor/config";

// --- DOM Elements ---
let tsvInput, pdfInput, processBtn, resetBtn, tsvIndicator, pdfIndicator, loader, loaderText, outputSection, warningSection, warningList, downloadBtn, tsvDropArea, pdfDropArea, progressBar, ruleConfigList, addRuleBtn, saveRulesBtn, ruleCategorySelect, ruleCodeInput, outputTable, outputTableBody, settingsModal;

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
    fetchConfigFromDb();
    console.log("Payslip Processor Initialized");
}

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
    ruleConfigList = document.getElementById('rule-config-table-container');
    addRuleBtn = document.getElementById('add-rule-btn');
    saveRulesBtn = document.getElementById('save-rules-btn');
    ruleCategorySelect = document.getElementById('rule-category-select');
    ruleCodeInput = document.getElementById('rule-code-input');
    outputTable = document.getElementById('payslip-output-table');
    outputTableBody = document.getElementById('payslip-output-table-body');
    settingsModal = document.getElementById('settings-modal');
}

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
    
    document.getElementById('open-settings-modal-btn')?.addEventListener('click', () => settingsModal.style.display = 'flex');
    document.getElementById('close-settings-modal-btn')?.addEventListener('click', () => settingsModal.style.display = 'none');
    
    if(outputTableBody) outputTableBody.addEventListener('click', handleTableClick);
}

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
            if (config.ruleMappings) ruleMappings = config.ruleMappings;
            if (config.ignoredCodes) ignoredCodes = new Set(config.ignoredCodes.map(String));
            console.log("Fetched config from DB.");
        }
        renderRuleConfigTable();
    } catch (err) {
        console.error("Error fetching config:", err);
        showError("Could not fetch config from Firebase.");
    }
}

async function saveConfigToDb() {
    if (!db) return;
    try {
        const docRef = doc(db, DB_CONFIG_PATH);
        const config = {
            ruleMappings: ruleMappings,
            ignoredCodes: Array.from(ignoredCodes)
        };
        await setDoc(docRef, config);
        alert("Regras salvas com sucesso!");
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
    payslipData.clear();

    try {
        if (tsvFile) {
            nameList = (await tsvFile.text()).split('\n').map(n => n.trim().toUpperCase()).filter(Boolean);
        } else {
            nameList = [];
        }

        let processedCount = 0;
        for (const pdf of pdfFiles) {
            processedCount++;
            const progress = (processedCount / pdfFiles.length) * 100;
            showLoader(true, `Processing file ${processedCount} of ${pdfFiles.length}...`, progress);
            
            if (pdf.size === 0) continue;

            try {
                const dataMap = await processPdf(pdf);
                dataMap.forEach((value, key) => payslipData.set(key, value));
            } catch (pdfError) {
                 console.error(`Failed to process ${pdf.name}.`, pdfError);
                 const tempName = pdf.name.replace('.pdf', '').toUpperCase();
                 payslipData.set(tempName, { status: 'error', error: pdfError.message, originalFile: { name: pdf.name, dataUrl: URL.createObjectURL(pdf) } });
            }
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
    const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, base64: reader.result.split(',')[1] });
        reader.onerror = error => reject(error);
    });

    const prompt = `
        Your task is to extract data from a payslip PDF with 100% accuracy.
        The document contains a main table with the headers: 'Código', 'Descrição', 'Referência', 'Vencimentos', and 'Descontos'.
        
        Your instructions are:
        1.  First, identify the full name of the employee. It is usually at the top of the document.
        2.  Next, analyze the main table row by row.
        3.  For each row, you MUST correctly associate the text in the 'Descrição' column with the numeric values in the 'Vencimentos' (Earnings) and 'Descontos' (Deductions) columns that are on the exact same horizontal line.
        4.  **CRITICAL**: You MUST IGNORE the 'Referência' column. Do not use its values for the final output. The correct values are ONLY in the 'Vencimentos' and 'Descontos' columns.
        5.  If a value for 'Vencimentos' or 'Descontos' is empty on a given line, you MUST use the number 0.
        6.  After extracting all line items, provide a confidence score from 0.0 to 1.0.
        
        Return a single JSON object with "employeeName", "lineItems", and "confidence". Return ONLY the raw JSON object.
    `;

    const payload = {
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: fileData.base64 } }] }],
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
                    },
                    confidence: {
                        type: "OBJECT",
                        properties: { score: { type: "NUMBER" }, reasoning: { type: "STRING" } },
                        required: ["score", "reasoning"]
                    }
                },
                required: ["employeeName", "lineItems", "confidence"]
            }
        }
    };

    const resultText = await makeApiCallWithRetry(payload);
    const parsedResult = JSON.parse(resultText);
    
    const normalizedMap = new Map();
    if (parsedResult.employeeName && parsedResult.lineItems) {
        const name = parsedResult.employeeName.toUpperCase().trim();
        normalizedMap.set(name, { ...parsedResult, originalFile: fileData });
    }
    return normalizedMap;
}


async function makeApiCallWithRetry(payload, maxRetries = 3) {
    const model = "gemini-2.5-flash-lite"; // Reverted to Pro model for highest accuracy
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let delay = 2000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
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
    const headers = ["", "Nome", "Comissão", "Vale Adiantamento", "VT Desconto", "Salário Família", "Desconto Empréstimo", "Horas Extras", "Desconto Faltas"];
    if(outputTable.querySelector('thead')) outputTable.querySelector('thead').innerHTML = `<tr>${headers.map(h => `<th scope="col" class="px-6 py-3">${h}</th>`).join('')}</tr>`;
    if(outputTableBody) outputTableBody.innerHTML = '';

    const foundCodes = new Map();
    const namesToProcess = nameList.length > 0 ? Array.from(new Set([...nameList, ...Array.from(payslipData.keys())])) : Array.from(payslipData.keys()).sort();
    
    const codeToCategory = new Map();
    for (const category in ruleMappings) {
        ruleMappings[category].forEach(code => codeToCategory.set(String(code), category));
    }

    namesToProcess.forEach(name => {
        const upperCaseName = name.toUpperCase().trim();
        const data = payslipData.get(upperCaseName);
        let rowData = { comissao: 0, valeAdiantamento: 0, vtDesconto: 0, salarioFamilia: 0, descontoEmprestimo: 0, horasExtrasValor: 0, descontoFaltas: 0 };

        if (data && data.lineItems) {
            data.lineItems.forEach(item => {
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
        if (!data) {
            newRow.classList.add('hidden-row', 'hidden');
        }
        
        const actionCell = newRow.insertCell();
        actionCell.className = "px-6 py-4";
        if (data) {
            if (data.status === 'error') {
                 actionCell.innerHTML = `<span title="Erro: ${data.error}" class="text-red-500 font-bold text-lg">!</span>`;
            } else {
                const confidenceScore = data.confidence?.score ?? 0;
                if (confidenceScore < 0.95) {
                    actionCell.innerHTML += `<span title="Confiança baixa: ${data.confidence?.reasoning}" class="text-yellow-500 font-bold mr-2">!</span>`;
                }
                actionCell.innerHTML += `<button data-name="${upperCaseName}" class="view-pdf-btn text-blue-500 hover:text-blue-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-search" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
                </button>`;
            }
        }
        
        newRow.insertCell().textContent = name;

        Object.keys(rowData).forEach(key => {
            const cell = newRow.insertCell();
            cell.textContent = (rowData[key] === 0 ? '0,00' : rowData[key].toFixed(2).replace('.', ','));
            cell.setAttribute('contenteditable', 'true');
            cell.className = "px-6 py-4 text-center";
        });
    });
    
    if (outputTableBody.querySelector('.hidden-row')) {
        let footer = outputTable.querySelector('tfoot');
        if (footer) footer.remove();
        footer = outputTable.createTFoot();
        const row = footer.insertRow();
        const cell = row.insertCell();
        cell.colSpan = headers.length;
        cell.innerHTML = `<button id="show-all-btn" class="dev-btn btn-secondary w-full mt-2">+ Mostrar nomes não processados</button>`;
        document.getElementById('show-all-btn').addEventListener('click', () => {
            outputTableBody.querySelectorAll('.hidden-row').forEach(r => r.classList.remove('hidden'));
            footer.style.display = 'none';
        });
    }

    newFoundCodes = foundCodes;
    if (payslipData.size > 0) outputSection.style.display = 'block';
    if (newFoundCodes.size > 0) displayWarnings(); else if(warningSection) warningSection.style.display = 'none';
}

function displayWarnings() {
    warningList.innerHTML = '';
    if (newFoundCodes.size === 0) return;
    newFoundCodes.forEach((desc, code) => {
        const warningEl = document.createElement('div');
        warningEl.className = 'flex items-center justify-between text-sm py-2 px-3 bg-gray-50 rounded-md shadow-sm';
        warningEl.innerHTML = `<span class="truncate pr-4"><strong class="font-semibold text-gray-800">Code ${code}:</strong> <span class="text-gray-600">${desc}</span></span>
                              <button data-code="${code}" class="ignore-btn dev-btn btn-tertiary">Ignore</button>`;
        warningList.appendChild(warningEl);
    });
    warningSection.style.display = 'block';
}

function handleIgnoreClick(event) {
    if (!event.target.classList.contains('ignore-btn')) return;
    const codeToIgnore = event.target.dataset.code;
    
    ignoredCodes.add(String(codeToIgnore));
    saveConfigToDb();
    newFoundCodes.delete(Number(codeToIgnore));
    renderResults();
}

function downloadTsv() {
    const headers = ["Nome", "Comissão", "Vale Adiantamento", "VT Desconto", "Salário Família", "Desconto Empréstimo", "Horas Extras", "Desconto Faltas"];
    let tsvContent = headers.join('\t') + '\n';
    
    const namesToExport = nameList.length > 0 ? nameList : Array.from(payslipData.keys()).sort();
    
    namesToExport.forEach(name => {
        const upperCaseName = name.toUpperCase().trim();
        const row = Array.from(outputTableBody.querySelectorAll('tr')).find(r => r.cells[1].textContent.toUpperCase().trim() === upperCaseName);
        if (row) {
            const rowData = Array.from(row.querySelectorAll('td')).slice(1).map(td => td.textContent);
            tsvContent += rowData.join('\t') + '\n';
        } else {
            tsvContent += `${name}\t0,00\t0,00\t0,00\t0,00\t0,00\t0,00\t0,00\n`;
        }
    });
    
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "folhas_processadas.tsv");
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
function renderRuleConfigTable() {
    if (!ruleConfigList) return;
    ruleConfigList.innerHTML = '';
    const allCategories = { ...ruleMappings, ignored: Array.from(ignoredCodes) };

    for (const category in allCategories) {
        const categoryName = ruleCategorySelect.querySelector(`option[value=${category}]`)?.textContent || "Ignorados";
        const col = document.createElement('div');
        col.className = 'border rounded-md p-2';
        let codesHTML = allCategories[category].map(code => `<div class="flex justify-between items-center text-sm p-1 bg-gray-100 rounded mt-1"><span>${code}</span><button data-code="${code}" data-category="${category}" class="remove-rule-btn text-red-400 hover:text-red-600">&times;</button></div>`).join('');
        col.innerHTML = `<h4 class="font-semibold">${categoryName}</h4>${codesHTML}`;
        ruleConfigList.appendChild(col);
    }
    ruleConfigList.querySelectorAll('.remove-rule-btn').forEach(btn => btn.addEventListener('click', removeRule));
}

function addRule() {
    const category = ruleCategorySelect.value;
    const code = Number(ruleCodeInput.value);
    if (!category || !code) return;

    if (category === 'ignored') {
        ignoredCodes.add(String(code));
    } else {
        if (!ruleMappings[category]) ruleMappings[category] = [];
        if (!ruleMappings[category].includes(code)) ruleMappings[category].push(code);
    }
    ruleCodeInput.value = '';
    renderRuleConfigTable();
}

function removeRule(event) {
    const { code, category } = event.target.dataset;
    if (category === 'ignored') {
        ignoredCodes.delete(String(code));
    } else if (ruleMappings[category]) {
        ruleMappings[category] = ruleMappings[category].filter(c => c !== Number(code));
    }
    renderRuleConfigTable();
}

// --- PDF Snippet Viewer ---
async function handleTableClick(event) {
    const viewBtn = event.target.closest('.view-pdf-btn');
    if (viewBtn) {
        const row = viewBtn.closest('tr');
        const name = viewBtn.dataset.name;
        const data = payslipData.get(name);

        let snippetRow = row.nextElementSibling;
        if (snippetRow && snippetRow.classList.contains('snippet-row')) {
            snippetRow.remove();
        } else if (data && data.originalFile) {
            snippetRow = outputTableBody.insertRow(row.rowIndex + 1);
            snippetRow.className = 'snippet-row';
            const cell = snippetRow.insertCell();
            cell.colSpan = outputTable.rows[0].cells.length;
            cell.innerHTML = `<div class="p-4 bg-gray-100 flex justify-center items-center"><canvas></canvas></div>`;
            await renderPdfSnippet(data.originalFile, cell.querySelector('canvas'));
        }
    }
}

async function renderPdfToImage(dataUrl) {
    const pdf = await pdfjsLib.getDocument(dataUrl).promise;
    const page = await pdf.getPage(1);
    
    const viewport = page.getViewport({ scale: 2.0, offsetY: -400 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    return canvas.toDataURL('image/png').split(',')[1];
}

async function renderPdfSnippet(file, canvas) {
    const pdf = await pdfjsLib.getDocument(file.dataUrl).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5, offsetY: -400 });
    
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport: viewport }).promise;
}
