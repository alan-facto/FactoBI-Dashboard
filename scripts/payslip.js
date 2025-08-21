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
let tsvFile = null; // FIX: Re-declared tsvFile in the global scope
let pdfFiles = [];
let nameList = [];
let payslipData = new Map(); // Stores processed data, including file reference and confidence
let newFoundCodes = new Map();
let ignoredCodes = new Set([
    1, 998, 8697, 8699, 5, 896, 931, 805, 806, 937, 812, 821, 848, 8504, 999, 4, 894, 100, 843
].map(String));

const DB_CONFIG_PATH = "payslipProcessor/config";

// --- DOM Elements ---
let tsvInput, pdfInput, processBtn, resetBtn, tsvIndicator, pdfIndicator, loader, loaderText, outputSection, warningSection, warningList, downloadBtn, tsvDropArea, pdfDropArea, progressBar, ruleConfigList, addRuleBtn, saveRulesBtn, ruleCategorySelect, ruleCodeInput, outputTable, outputTableBody, settingsModal, pdfViewerModal, pdfCanvas;

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
    pdfViewerModal = document.getElementById('pdf-viewer-modal');
    pdfCanvas = document.getElementById('pdf-canvas');
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
    
    // Modal listeners
    document.getElementById('open-settings-modal-btn')?.addEventListener('click', () => settingsModal.style.display = 'flex');
    document.getElementById('close-settings-modal-btn')?.addEventListener('click', () => settingsModal.style.display = 'none');
    document.getElementById('close-pdf-viewer-btn')?.addEventListener('click', () => pdfViewerModal.style.display = 'none');
    
    // Listener for dynamic view PDF buttons
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
            nameList = (await tsvFile.text()).split('\n').map(n => n.trim()).filter(Boolean);
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
                 showError(`An error occurred while processing ${pdf.name}. It has been skipped.`);
            }
            renderResults(); // Safety render after each file
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
        Your task is to perform optical character recognition (OCR) and data extraction on a payslip PDF with 100% accuracy.
        The table has columns: 'Código', 'Descrição', 'Referência', 'Vencimentos', and 'Descontos'.
        Your primary challenge is to correctly associate values from the 'Vencimentos' (Earnings) and 'Descontos' (Deductions) columns with their corresponding 'Descrição' (Description) on the same horizontal line.
        These documents often use sparse layouts. A value in a right-hand column belongs to the description on its immediate left, regardless of vertical spacing. For example, the value '138,82' in the 'Descontos' column is directly associated with 'I.N.S.S.' in the 'Descrição' column on the same line. Do not mis-associate it with items on lines above or below.
        
        Mandatory Steps:
        1.  Identify the employee's full name, usually in a large font at the top.
        2.  For every single row in the table, extract the 'Código', 'Descrição', 'Vencimentos', and 'Descontos'.
        3.  If a value for 'Vencimentos' or 'Descontos' is empty on a line, you MUST use 0.
        4.  After extraction, critically evaluate your own work. Assign a confidence score from 0.0 (uncertain) to 1.0 (certain) based on how clearly you could associate values with descriptions.
        5.  Provide a brief reasoning for your confidence score. For example, "Certainty is high due to clear, unambiguous table alignment" or "Confidence is lower because of potential ambiguity in row X".
        
        Return a single JSON object with three keys: "employeeName", "lineItems", and "confidence". The "confidence" object must contain "score" and "reasoning".
        Return ONLY the raw JSON object.
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
                        properties: {
                            score: { type: "NUMBER" },
                            reasoning: { type: "STRING" }
                        },
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
        // Store the full result, including the file data for the viewer
        normalizedMap.set(name, { ...parsedResult, originalFile: fileData });
    }
    return normalizedMap;
}

async function makeApiCallWithRetry(payload, maxRetries = 3) {
    const model = "gemini-1.5-flash-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let delay = 2000; // Increased initial delay for rate-limiting
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
    if(outputTable) outputTable.querySelector('thead').innerHTML = `<tr>${headers.map(h => `<th scope="col" class="px-6 py-3">${h}</th>`).join('')}</tr>`;
    if(outputTableBody) outputTableBody.innerHTML = '';

    const foundCodes = new Map();
    const namesToProcess = nameList.length > 0 ? nameList : Array.from(payslipData.keys()).sort();
    
    const codeToCategory = new Map();
    for (const category in ruleMappings) {
        ruleMappings[category].forEach(code => codeToCategory.set(String(code), category));
    }

    namesToProcess.forEach(name => {
        const data = payslipData.get(name.toUpperCase().trim());
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
        
        // Confidence Indicator & View PDF Button Cell
        const actionCell = newRow.insertCell();
        actionCell.className = "px-6 py-4";
        if (data) {
            const confidenceScore = data.confidence?.score ?? 0;
            if (confidenceScore < 0.95) {
                actionCell.innerHTML += `<span title="Confiança baixa: ${data.confidence?.reasoning}" class="text-yellow-500 font-bold">!</span>`;
            }
            actionCell.innerHTML += `<button data-name="${name.toUpperCase().trim()}" class="view-pdf-btn ml-2 text-blue-500 hover:underline">Ver PDF</button>`;
        }
        
        // Name Cell
        newRow.insertCell().textContent = name;

        // Data Cells
        Object.keys(rowData).forEach(key => {
            const cell = newRow.insertCell();
            cell.textContent = (rowData[key] === 0 ? '0,00' : rowData[key].toFixed(2).replace('.', ','));
            cell.setAttribute('contenteditable', 'true');
            cell.className = "px-6 py-4 text-center"; // Centered values
        });
    });

    newFoundCodes = foundCodes;
    if (payslipData.size > 0) outputSection.style.display = 'block';
    if (newFoundCodes.size > 0) displayWarnings(); else warningSection.style.display = 'none';
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
    outputTableBody.querySelectorAll('tr').forEach(row => {
        const rowData = Array.from(row.querySelectorAll('td')).slice(1).map(td => td.textContent); // Slice to skip action cell
        tsvContent += rowData.join('\t') + '\n';
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
    if (event.target.classList.contains('view-pdf-btn')) {
        const name = event.target.dataset.name;
        const data = payslipData.get(name);
        if (data && data.originalFile) {
            await renderPdfSnippet(data.originalFile, name);
        }
    }
}

async function renderPdfSnippet(file, name) {
    document.getElementById('pdf-viewer-title').textContent = `Holerite de ${name}`;
    pdfViewerModal.style.display = 'flex';
    
    const loadingTask = pdfjsLib.getDocument(file.dataUrl);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    
    // This viewport will attempt to crop to the main table area.
    // You may need to adjust these values for different payslip layouts.
    const viewport = page.getViewport({ scale: 1.5, offsetY: -400, rotation: 0 });

    const context = pdfCanvas.getContext('2d');
    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;
    
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    await page.render(renderContext).promise;
}
