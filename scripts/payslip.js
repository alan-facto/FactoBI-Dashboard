// scripts/payslip.js

import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app } from './main.js';

// --- Module State ---
let db;
let tsvFile = null;
let pdfFiles = [];
let nameList = [];
let payslipData = new Map();
let newFoundCodes = new Map();
let ignoredCodes = new Set();

const IGNORED_CODES_DOC_PATH = "payslipProcessor/ignoredCodes";

// --- DOM Elements ---
let tsvInput, pdfInput, processBtn, tsvIndicator, pdfIndicator, loader, outputSection, outputTextarea, warningSection, warningList, downloadBtn, tsvDropArea, pdfDropArea;

/**
 * Initializes the payslip processor module.
 */
export function initPayslipProcessor() {
    db = getFirestore(app);

    // Cache DOM elements
    tsvInput = document.getElementById('payslip-tsv-upload');
    pdfInput = document.getElementById('payslip-pdf-upload');
    processBtn = document.getElementById('payslip-process-btn');
    tsvIndicator = document.getElementById('tsv-file-indicator');
    pdfIndicator = document.getElementById('pdf-file-indicator');
    loader = document.getElementById('payslip-loader');
    outputSection = document.getElementById('payslip-output-section');
    outputTextarea = document.getElementById('payslip-output');
    warningSection = document.getElementById('payslip-warning-section');
    warningList = document.getElementById('payslip-warning-list');
    downloadBtn = document.getElementById('payslip-download-btn');
    tsvDropArea = document.getElementById('tsv-drop-area');
    pdfDropArea = document.getElementById('pdf-drop-area');

    if (!processBtn) return;

    // --- Event Listeners ---
    tsvInput.addEventListener('change', (e) => handleTsvSelect(e.target.files));
    pdfInput.addEventListener('change', (e) => handlePdfSelect(e.target.files));
    
    // Drag and Drop Listeners
    setupDragDrop(tsvDropArea, handleTsvSelect);
    setupDragDrop(pdfDropArea, handlePdfSelect);

    processBtn.addEventListener('click', handleProcessing);
    warningSection.addEventListener('click', handleIgnoreClick);
    downloadBtn.addEventListener('click', downloadTsv);

    fetchIgnoredCodes();
    console.log("Payslip Processor Initialized");
}

function setupDragDrop(area, fileHandler) {
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragover');
    });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            fileHandler(e.dataTransfer.files);
        }
    });
}

function handleTsvSelect(files) {
    tsvFile = files[0] || null;
    tsvIndicator.textContent = tsvFile ? tsvFile.name : "Nenhum arquivo selecionado.";
    checkProcessButtonState();
}

function handlePdfSelect(files) {
    pdfFiles = Array.from(files);
    if (pdfFiles.length > 0) {
        pdfIndicator.textContent = `${pdfFiles.length} PDF(s) selecionado(s).`;
    } else {
        pdfIndicator.textContent = "Nenhum arquivo selecionado.";
    }
    checkProcessButtonState();
}

function checkProcessButtonState() {
    processBtn.disabled = pdfFiles.length === 0;
}

async function fetchIgnoredCodes() {
    const localIgnored = JSON.parse(localStorage.getItem('ignoredPayslipCodes')) || [];
    let combinedIgnored = new Set(localIgnored.map(String));
    if (!db) return;
    try {
        const docRef = doc(db, IGNORED_CODES_DOC_PATH);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const firestoreCodes = docSnap.data().codes || [];
            firestoreCodes.forEach(code => combinedIgnored.add(String(code)));
        }
        ignoredCodes = combinedIgnored;
        console.log("Fetched ignored codes:", Array.from(ignoredCodes));
    } catch (err) {
        console.error("Error fetching ignored codes:", err);
        showError("Could not fetch ignored codes from Firebase.");
    }
}

async function updateIgnoredCodesInDb(updatedCodesSet) {
    if (!db) {
        console.error("Firestore DB not initialized.");
        return;
    }
    try {
        const docRef = doc(db, IGNORED_CODES_DOC_PATH);
        const codesArray = Array.from(updatedCodesSet);
        await setDoc(docRef, { codes: codesArray });
        console.log("Successfully attempted to update ignored codes in Firebase with:", codesArray);
    } catch (err) {
        console.error("Error updating ignored codes:", err);
        showError(`Could not save ignored codes to Firebase: ${err.message}. Check Firestore security rules.`);
    }
}

async function handleProcessing() {
    showLoader(true);
    processBtn.disabled = true;
    showError('');
    outputSection.style.display = 'none';
    warningSection.style.display = 'none';
    newFoundCodes.clear();

    try {
        if (tsvFile) {
            const namesText = await tsvFile.text();
            nameList = namesText.split('\n').map(n => n.trim()).filter(Boolean);
        } else {
            nameList = [];
        }

        const allPayslipData = new Map();
        // Process all PDF files concurrently
        const processingPromises = pdfFiles.map(pdf => processPdf(pdf));
        const results = await Promise.all(processingPromises);

        results.forEach(dataMap => {
            dataMap.forEach((value, key) => allPayslipData.set(key, value));
        });
        
        payslipData = allPayslipData;
        correlateAndGenerateOutput();

    } catch (err) {
        console.error("File processing error:", err);
        showError(`An error occurred: ${err.message}`);
    } finally {
        showLoader(false);
        checkProcessButtonState();
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
        Analyze the provided PDF, which contains a single-page payslip.
        You MUST identify the employee's full name, which is typically in a large font above the main table of values.
        Then, for that employee, meticulously extract every single line item from the table.
        For each line item, you MUST provide:
        1. 'codigo': The number from the 'Código' column.
        2. 'descricao': The text from the 'Descrição' column.
        3. 'vencimentos': The numerical value from the 'Vencimentos' (Earnings) column. If this cell is empty for a line, use 0.
        4. 'descontos': The numerical value from the 'Descontos' (Deductions) column. If this cell is empty for a line, use 0.
        It is critical to correctly associate values with their descriptions, even if there are large empty spaces in the table layout.
        Return the data as a single JSON object where the key is the employee's full name (in uppercase) and the value is an array of their line items.
    `;

    const payload = {
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: base64File } }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {},
                additionalProperties: {
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
            }
        }
    };

    const resultText = await makeApiCallWithRetry(payload);
    const parsedResult = JSON.parse(resultText);
    const normalizedMap = new Map();
    for (const name in parsedResult) {
        normalizedMap.set(name.toUpperCase().trim(), parsedResult[name]);
    }
    return normalizedMap;
}

async function makeApiCallWithRetry(payload, maxRetries = 3) {
    const apiKey = ""; // This will be provided by the environment
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                return result.candidates[0].content.parts[0].text;
            } else {
                throw new Error("Invalid response structure from API.");
            }
        } catch (error) {
            console.warn(`API call attempt ${i + 1} failed. Retrying in ${delay / 1000}s...`);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
    throw new Error("API call failed after multiple retries.");
}

function correlateAndGenerateOutput() {
    const tsvRows = [];
    const header = "Nome\tComissão\tVale Adiantamento\tVT Desconto\tSalário Família\tDesconto Empréstimo\tHoras Extras\tDesconto Faltas";
    tsvRows.push(header);

    const foundCodes = new Map();
    const namesToProcess = nameList.length > 0 ? nameList : Array.from(payslipData.keys()).sort();

    namesToProcess.forEach(name => {
        const personData = payslipData.get(name.toUpperCase().trim());
        let rowData = { comissao: 0, valeAdiantamento: 0, vtDesconto: 0, salarioFamilia: 0, descontoEmprestimo: 0, horasExtrasValor: 0, descontoFaltas: 0 };

        if (personData) {
            personData.forEach(item => {
                const desc = item.descricao.toUpperCase();
                const codigo = item.codigo || 0;
                let processed = false;

                // Apply special rules
                if (desc.includes('COMISS')) { rowData.comissao += item.vencimentos || 0; processed = true; }
                if (desc.includes('EXTRAS')) { rowData.horasExtrasValor += item.vencimentos || 0; processed = true; }
                if (desc.includes('FALTAS')) { rowData.descontoFaltas += item.descontos || 0; processed = true; }
                if (desc.includes('VALE TRANSPORTE') || desc.includes('VT')) { rowData.vtDesconto += item.descontos || 0; processed = true; }
                if (desc.includes('ADIANTAMENTO') || codigo === 981) { rowData.valeAdiantamento += item.descontos || 0; processed = true; }
                if (desc.includes('SALARIO FAMILIA')) { rowData.salarioFamilia += item.vencimentos || 0; processed = true; }
                if (desc.includes('EMPRESTIMO') || desc.includes('DESC. EMP')) { rowData.descontoEmprestimo += item.descontos || 0; processed = true; }

                if (!processed && !ignoredCodes.has(String(codigo)) && (item.vencimentos > 0 || item.descontos > 0)) {
                    if (!foundCodes.has(codigo)) foundCodes.set(codigo, item.descricao);
                }
            });
        }

        const formatValue = (value) => value === 0 ? '0,00' : value.toFixed(2).replace('.', ',');
        const row = [name, formatValue(rowData.comissao), formatValue(rowData.valeAdiantamento), formatValue(rowData.vtDesconto), formatValue(rowData.salarioFamilia), formatValue(rowData.descontoEmprestimo), formatValue(rowData.horasExtrasValor), formatValue(rowData.descontoFaltas)].join('\t');
        tsvRows.push(row);
    });

    newFoundCodes = foundCodes;
    if (newFoundCodes.size === 0) {
        outputTextarea.value = tsvRows.join('\n');
        outputSection.style.display = 'block';
        warningSection.style.display = 'none';
    } else {
        displayWarnings();
        outputSection.style.display = 'none';
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
        warningEl.className = 'flex items-center justify-between text-sm py-1';
        warningEl.innerHTML = `<span><strong class="font-semibold">Code ${code}:</strong> ${desc}</span><button data-code="${code}" class="ignore-btn dev-btn btn-tertiary">Ignore</button>`;
        warningList.appendChild(warningEl);
    });
    warningSection.style.display = 'block';
}

function handleIgnoreClick(event) {
    if (!event.target.classList.contains('ignore-btn')) return;
    const codeToIgnore = event.target.dataset.code;
    ignoredCodes.add(String(codeToIgnore));
    updateIgnoredCodesInDb(ignoredCodes);
    newFoundCodes.delete(Number(codeToIgnore));
    if (newFoundCodes.size === 0) {
        correlateAndGenerateOutput();
    } else {
        displayWarnings();
    }
}

function downloadTsv() {
    const tsvContent = outputTextarea.value;
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

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const errorEl = document.getElementById('payslip-error');
    errorEl.textContent = message;
    errorEl.style.display = message ? 'block' : 'none';
}
