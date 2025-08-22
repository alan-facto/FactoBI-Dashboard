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
const BATCH_SIZE = 5; // Balanced batch size for the Flash model
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
                const consensusData = await processPdfWithConsensus(pdf);
                payslipData.set(consensusData.employeeName.toUpperCase().trim(), consensusData);
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

async function processPdfWithConsensus(file) {
    const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, base64: reader.result.split(',')[1] });
        reader.onerror = error => reject(error);
    });

    // --- THREE-PASS ANALYSIS ---
    const [pdfResult, imageResult, textResult] = await Promise.all([
        runPdfPass(fileData.base64),
        runImagePass(fileData.dataUrl),
        runTextPass(fileData.dataUrl)
    ]);

    // --- CONSENSUS LOGIC ---
    const allNames = [pdfResult.employeeName, imageResult.employeeName, textResult.employeeName].filter(Boolean);
    const consensusName = findMostFrequent(allNames) || "Unknown";

    const allLineItems = [
        ...(pdfResult.lineItems || []),
        ...(imageResult.lineItems || []),
        ...(textResult.lineItems || [])
    ];
    
    const consensusLineItems = getConsensusLineItems(allLineItems);

    return {
        employeeName: consensusName,
        lineItems: consensusLineItems,
        originalFile: fileData,
        // We can add confidence later if needed
    };
}

function findMostFrequent(arr) {
    if (!arr.length) return null;
    const counts = arr.reduce((acc, val) => {
        const upperVal = val.toUpperCase().trim();
        acc[upperVal] = (acc[upperVal] || 0) + 1;
        return acc;
    }, {});
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

function getConsensusLineItems(allItems) {
    const itemsByCode = allItems.reduce((acc, item) => {
        if (!acc[item.codigo]) acc[item.codigo] = [];
        acc[item.codigo].push(item);
        return acc;
    }, {});

    const consensusItems = [];
    for (const code in itemsByCode) {
        const items = itemsByCode[code];
        const consensusDesc = findMostFrequent(items.map(i => i.descricao));
        const consensusVenc = findMostFrequent(items.map(i => i.vencimentos));
        const consensusDescD = findMostFrequent(items.map(i => i.descontos));
        
        consensusItems.push({
            codigo: Number(code),
            descricao: consensusDesc,
            vencimentos: Number(consensusVenc),
            descontos: Number(consensusDescD),
            isDisputed: new Set(items.map(i => i.vencimentos)).size > 1 || new Set(items.map(i => i.descontos)).size > 1,
            options: items
        });
    }
    return consensusItems;
}


async function runPdfPass(base64) {
    const prompt = `Your task is to extract data from a payslip PDF with 100% accuracy. The table has headers: 'Código', 'Descrição', 'Referência', 'Vencimentos', and 'Descontos'. For each row, you MUST correctly associate the 'Descrição' with the numeric values in the 'Vencimentos' and 'Descontos' columns on the same horizontal line. IGNORE the 'Referência' column. If a value is empty, use 0. Return a JSON object with "employeeName" and "lineItems".`;
    const payload = {
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: base64 } }] }],
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
    return JSON.parse(resultText);
}

async function runImagePass(dataUrl) {
    const imageBase64 = await renderPdfToImage(dataUrl);
    const prompt = `Analyze the provided IMAGE of a payslip table with 100% accuracy. Extract the employee's name and all line items, associating values in 'Vencimentos' and 'Descontos' with the correct 'Descrição' on the same horizontal line. IGNORE the 'Referência' column. If a value is empty, use 0. Return a JSON object with "employeeName" and "lineItems".`;
    const payload = {
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: imageBase64 } }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: { /* Same schema as runPdfPass */ }
        }
    };
    payload.generationConfig.responseSchema = (await runPdfPass("")).generationConfig.responseSchema; // Reuse schema
    const resultText = await makeApiCallWithRetry(payload);
    return JSON.parse(resultText);
}

async function runTextPass(dataUrl) {
    const textContent = await extractTextWithCoordinates(dataUrl);
    const assembledRows = assembleRowsFromOcr(textContent.items);
    const prompt = `From the following lines of text from a payslip, identify the employee's name and extract the line items. For each table row, extract the code, description, earnings (Vencimentos), and deductions (Descontos). Return a JSON object with "employeeName" and "lineItems". Text Lines:\n${assembledRows.join('\n')}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: { /* Same schema as runPdfPass */ }
        }
    };
    payload.generationConfig.responseSchema = (await runPdfPass("")).generationConfig.responseSchema; // Reuse schema
    const resultText = await makeApiCallWithRetry(payload);
    return JSON.parse(resultText);
}


async function makeApiCallWithRetry(payload, maxRetries = 3) {
    const model = "gemini-2.5-flash"; // Using the specified Flash model
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let delay = 1000;
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
                return JSON.stringify({ employeeName: "Error", lineItems: [] }); // Return empty on failure
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
            actionCell.innerHTML += `<button data-name="${upperCaseName}" class="view-pdf-btn text-blue-500 hover:text-blue-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-search" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
            </button>`;
        }
        
        newRow.insertCell().textContent = name;

        Object.keys(rowData).forEach(key => {
            const cell = newRow.insertCell();
            const value = (rowData[key] === 0 ? '0,00' : rowData[key].toFixed(2).replace('.', ','));
            
            // Check for disputes
            const lineItem = data?.lineItems.find(item => codeToCategory.get(String(item.codigo)) === key);
            if(lineItem?.isDisputed) {
                cell.innerHTML = `<select class="bg-yellow-100 border border-yellow-400 rounded-md p-1">
                    ${lineItem.options.map(opt => `<option value="${opt.vencimentos > 0 ? opt.vencimentos : opt.descontos}">${(opt.vencimentos > 0 ? opt.vencimentos : opt.descontos).toFixed(2).replace('.', ',')}</option>`).join('')}
                </select>`;
            } else {
                cell.textContent = value;
            }
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

// ... (The rest of the functions: displayWarnings, handleIgnoreClick, downloadTsv, showLoader, showError, renderRuleConfigTable, addRule, removeRule, handleTableClick, renderPdfToImage, renderPdfSnippet) remain largely the same ...

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
