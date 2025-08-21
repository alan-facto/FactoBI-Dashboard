// scripts/payslip.js

// Using the latest modular Firebase SDK for better performance and tree-shaking.
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app } from './main.js';

// --- IMPORTANT: PASTE YOUR GEMINI API KEY HERE FOR DEVELOPMENT ---
const GEMINI_API_KEY = "AIzaSyBaM10J2fS0Zxa3GoL-DrCxyLFXYpeVeig";

// --- Hardcoded Rules based on the provided TSV ---
const ruleMappings = {
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
].map(String)); // Ensure all codes are strings for consistent checking

const BATCH_SIZE = 10; // Process 10 PDFs at a time to respect API rate limits.
const IGNORED_CODES_DOC_PATH = "payslipProcessor/ignoredCodes";

// --- DOM Elements ---
let tsvInput, pdfInput, processBtn, resetBtn, tsvIndicator, pdfIndicator, loader, loaderText, outputSection, outputTextarea, warningSection, warningList, downloadBtn, tsvDropArea, pdfDropArea, progressBar;

/**
 * Initializes the payslip processor module.
 */
export function initPayslipProcessor() {
    if (!app) {
        console.error("Firebase app is not initialized. Payslip Processor cannot start.");
        showError("Critical Error: Firebase connection failed. Please refresh the page.");
        return;
    }
    db = getFirestore(app);

    // Cache DOM elements
    tsvInput = document.getElementById('payslip-tsv-upload');
    pdfInput = document.getElementById('payslip-pdf-upload');
    processBtn = document.getElementById('payslip-process-btn');
    resetBtn = document.getElementById('payslip-reset-btn'); // New Reset Button
    tsvIndicator = document.getElementById('tsv-file-indicator');
    pdfIndicator = document.getElementById('pdf-file-indicator');
    loader = document.getElementById('payslip-loader');
    loaderText = document.getElementById('payslip-loader-text');
    progressBar = document.getElementById('payslip-progress-bar'); // New Progress Bar
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
    setupDragDrop(tsvDropArea, handleTsvSelect);
    setupDragDrop(pdfDropArea, handlePdfSelect);
    processBtn.addEventListener('click', handleProcessing);
    
    // ERROR FIX: Add a null check before adding the event listener
    if (resetBtn) {
        resetBtn.addEventListener('click', resetProcess);
    }

    warningSection.addEventListener('click', handleIgnoreClick);
    downloadBtn.addEventListener('click', downloadTsv);

    fetchIgnoredCodes();
    console.log("Payslip Processor Initialized");
}

/**
 * Resets the entire process and UI to its initial state.
 */
function resetProcess() {
    // Reset file variables and inputs
    tsvFile = null;
    pdfFiles = [];
    if(tsvInput) tsvInput.value = '';
    if(pdfInput) pdfInput.value = '';

    // Reset data maps
    payslipData.clear();
    newFoundCodes.clear();

    // Reset UI elements
    if(tsvIndicator) tsvIndicator.textContent = "Nenhum arquivo selecionado.";
    if(pdfIndicator) pdfIndicator.textContent = "Nenhum arquivo selecionado.";
    if(outputSection) outputSection.style.display = 'none';
    if(warningSection) warningSection.style.display = 'none';
    if(outputTextarea) outputTextarea.value = '';
    if(warningList) warningList.innerHTML = '';
    showError('');
    showLoader(false);
    checkProcessButtonState();
    console.log("Process has been reset.");
}

function setupDragDrop(area, fileHandler) {
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('bg-blue-100', 'border-blue-400');
    });
    area.addEventListener('dragleave', () => area.classList.remove('bg-blue-100', 'border-blue-400'));
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('bg-blue-100', 'border-blue-400');
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
    pdfIndicator.textContent = pdfFiles.length > 0 ? `${pdfFiles.length} PDF(s) selecionado(s).` : "Nenhum arquivo selecionado.";
    checkProcessButtonState();
}

function checkProcessButtonState() {
    if(processBtn) processBtn.disabled = pdfFiles.length === 0;
}

async function fetchIgnoredCodes() {
    if (!db) return;
    try {
        const docRef = doc(db, IGNORED_CODES_DOC_PATH);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const firestoreCodes = docSnap.data().codes || [];
            // Merge Firestore codes with the hardcoded ones
            firestoreCodes.forEach(code => ignoredCodes.add(String(code)));
        }
        console.log("Fetched and merged ignored codes:", Array.from(ignoredCodes));
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
        // We only save the full set, including the pre-loaded ones.
        const codesArray = Array.from(updatedCodesSet);
        await setDoc(docRef, { codes: codesArray });
        console.log("Successfully updated ignored codes in Firebase:", codesArray);
    } catch (err) {
        console.error("Error updating ignored codes:", err);
        showError(`Could not save ignored codes to Firebase: ${err.message}. Check Firestore security rules.`);
    }
}

async function handleProcessing() {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
        showError("Please add your Gemini API Key to the payslip.js file on line 8.");
        return;
    }

    showLoader(true, `Starting processing...`, 0);
    processBtn.disabled = true;
    if (resetBtn) resetBtn.disabled = true; // Disable reset while processing
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
        for (let i = 0; i < pdfFiles.length; i += BATCH_SIZE) {
            const batch = pdfFiles.slice(i, i + BATCH_SIZE);
            const endNum = i + batch.length;
            
            for (const pdf of batch) {
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
            }
            
            correlateAndGenerateOutput();
            console.log(`Batch ending at file ${endNum} complete. TSV has been updated.`);
        }
        
    } catch (err) {
        console.error("File processing error:", err);
        showError(`An error occurred: ${err.message}`);
    } finally {
        showLoader(false);
        checkProcessButtonState();
        if(resetBtn) resetBtn.disabled = false; // Re-enable reset button
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
        Analyze the provided PDF, which contains a single-page payslip.
        You MUST identify the employee's full name, which is typically in a large font above the main table of values.
        Then, for that employee, meticulously extract every single line item from the table.
        For each line item, you MUST provide:
        1. 'codigo': The number from the 'Código' column.
        2. 'descricao': The text from the 'Descrição' column.
        3. 'vencimentos': The numerical value from the 'Vencimentos' (Earnings) column. If this cell is empty for a line, use 0.
        4. 'descontos': The numerical value from the 'Descontos' (Deductions) column. If this cell is empty for a line, use 0.
        It is critical to correctly associate values with their descriptions, even if there are large empty spaces in the table layout.
        Return the data as a single JSON object with two keys: "employeeName" (containing the full name in uppercase) and "lineItems" (containing the array of extracted line items).
        Return ONLY the raw JSON object, without any markdown formatting like \`\`\`json ... \`\`\`.
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
        console.warn("Parsed result was missing expected fields 'employeeName' or 'lineItems'", parsedResult);
    }
    return normalizedMap;
}

async function makeApiCallWithRetry(payload, maxRetries = 3) {
    const model = "gemini-1.5-flash-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    let delay = 1000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ error: { message: 'Could not parse error response.' } }));
                console.error("API Error Body:", errorBody);
                throw new Error(`API request failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
            }

            const result = await response.json();
            
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                return result.candidates[0].content.parts[0].text;
            } else {
                console.warn("API response was OK but lacked valid content.", result);
                throw new Error("Invalid or empty response structure from API.");
            }
        } catch (error) {
            console.warn(`API call attempt ${i + 1} failed. Retrying in ${delay / 1000}s...`, error.message);
            if (i === maxRetries - 1) {
                throw error;
            }
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
    
    // Create a reverse map for quick lookup of a code to its category
    const codeToCategory = new Map();
    for (const category in ruleMappings) {
        ruleMappings[category].forEach(code => {
            codeToCategory.set(String(code), category);
        });
    }

    namesToProcess.forEach(name => {
        const personData = payslipData.get(name.toUpperCase().trim());
        let rowData = { comissao: 0, valeAdiantamento: 0, vtDesconto: 0, salarioFamilia: 0, descontoEmprestimo: 0, horasExtrasValor: 0, descontoFaltas: 0 };

        if (personData) {
            personData.forEach(item => {
                const codigoStr = String(item.codigo || 0);
                const category = codeToCategory.get(codigoStr);
                
                if (category) {
                    // This code is in our hardcoded rules
                    if (item.vencimentos > 0) {
                        rowData[category] += item.vencimentos;
                    } else if (item.descontos > 0) {
                        rowData[category] += item.descontos;
                    }
                } else if (!ignoredCodes.has(codigoStr) && (item.vencimentos > 0 || item.descontos > 0)) {
                    // This is a new, unknown code
                    if (!foundCodes.has(item.codigo)) foundCodes.set(item.codigo, item.descricao);
                }
            });
        }

        const formatValue = (value) => value === 0 ? '0,00' : value.toFixed(2).replace('.', ',');
        const row = [name, formatValue(rowData.comissao), formatValue(rowData.valeAdiantamento), formatValue(rowData.vtDesconto), formatValue(rowData.salarioFamilia), formatValue(rowData.descontoEmprestimo), formatValue(rowData.horasExtrasValor), formatValue(rowData.descontoFaltas)].join('\t');
        tsvRows.push(row);
    });

    // Update the map of new codes found in this run
    newFoundCodes.forEach((desc, code) => {
        // This check ensures we only show warnings for codes that are truly new
        if(ignoredCodes.has(String(code)) || codeToCategory.has(String(code))) {
            newFoundCodes.delete(code);
        }
    });
    
    if (payslipData.size > 0) {
        outputTextarea.value = tsvRows.join('\n');
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
            <span class="truncate pr-4">
                <strong class="font-semibold text-gray-800">Code ${code}:</strong> 
                <span class="text-gray-600">${desc}</span>
            </span>
            <button data-code="${code}" class="ignore-btn inline-flex items-center justify-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
                Ignore
            </button>
        `;
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
    correlateAndGenerateOutput();
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

/**
 * Shows or hides the main loader element and updates progress.
 * @param {boolean} show True to show, false to hide.
 * @param {string} [message] The message to display in the loader.
 * @param {number} [progress] The progress percentage (0-100).
 */
function showLoader(show, message = 'Processing...', progress = 0) {
    if (loaderText) {
        loaderText.textContent = message;
    }
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
    loader.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const errorEl = document.getElementById('payslip-error');
    errorEl.textContent = message;
    errorEl.style.display = message ? 'block' : 'none';
}
