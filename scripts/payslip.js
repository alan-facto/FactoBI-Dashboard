// scripts/payslip.js

// Using the latest modular Firebase SDK for better performance and tree-shaking.
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app } from './main.js';

// --- IMPORTANT: PASTE YOUR GEMINI API KEY HERE FOR DEVELOPMENT ---
// For production, it's highly recommended to move this logic to a secure backend (like a Cloud Function)
// to protect your key.
const GEMINI_API_KEY = "AIzaSyBaM10J2fS0Zxa3GoL-DrCxyLFXYpeVeig";

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
    // This check helps prevent errors if the Firebase app from main.js isn't ready yet.
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

/**
 * Sets up drag and drop event listeners for a given area.
 * @param {HTMLElement} area The drop area element.
 * @param {Function} fileHandler The function to call with the dropped files.
 */
function setupDragDrop(area, fileHandler) {
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('bg-blue-100', 'border-blue-400'); // Visual feedback
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

/**
 * Handles the selection of the TSV file.
 * @param {FileList} files The selected files.
 */
function handleTsvSelect(files) {
    tsvFile = files[0] || null;
    tsvIndicator.textContent = tsvFile ? tsvFile.name : "Nenhum arquivo selecionado.";
    checkProcessButtonState();
}

/**
 * Handles the selection of PDF files.
 * @param {FileList} files The selected files.
 */
function handlePdfSelect(files) {
    pdfFiles = Array.from(files);
    if (pdfFiles.length > 0) {
        pdfIndicator.textContent = `${pdfFiles.length} PDF(s) selecionado(s).`;
    } else {
        pdfIndicator.textContent = "Nenhum arquivo selecionado.";
    }
    checkProcessButtonState();
}

/**
 * Enables or disables the process button based on file selection.
 */
function checkProcessButtonState() {
    processBtn.disabled = pdfFiles.length === 0;
}

/**
 * Fetches the list of ignored codes from Firestore.
 */
async function fetchIgnoredCodes() {
    if (!db) return;
    try {
        const docRef = doc(db, IGNORED_CODES_DOC_PATH);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const firestoreCodes = docSnap.data().codes || [];
            ignoredCodes = new Set(firestoreCodes.map(String));
        }
        console.log("Fetched ignored codes:", Array.from(ignoredCodes));
    } catch (err) {
        console.error("Error fetching ignored codes:", err);
        showError("Could not fetch ignored codes from Firebase.");
    }
}

/**
 * Updates the list of ignored codes in Firestore.
 * @param {Set<string>} updatedCodesSet The updated set of ignored codes.
 */
async function updateIgnoredCodesInDb(updatedCodesSet) {
    if (!db) {
        console.error("Firestore DB not initialized.");
        return;
    }
    try {
        const docRef = doc(db, IGNORED_CODES_DOC_PATH);
        const codesArray = Array.from(updatedCodesSet);
        await setDoc(docRef, { codes: codesArray });
        console.log("Successfully updated ignored codes in Firebase:", codesArray);
    } catch (err) {
        console.error("Error updating ignored codes:", err);
        showError(`Could not save ignored codes to Firebase: ${err.message}. Check Firestore security rules.`);
    }
}

/**
 * Main handler for starting the PDF processing.
 */
async function handleProcessing() {
    // Added a check to ensure the user has replaced the placeholder API key.
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
        showError("Please add your Gemini API Key to the payslip.js file on line 8.");
        return;
    }

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
        
        // --- RATE LIMIT FIX: Process PDFs sequentially instead of all at once ---
        let count = 1;
        for (const pdf of pdfFiles) {
            console.log(`Processing file ${count} of ${pdfFiles.length}: ${pdf.name}`);
            if (pdf.size === 0) {
                console.warn(`Skipping empty file: ${pdf.name}`);
                continue; // Skip to the next file in the loop
            }
            try {
                const dataMap = await processPdf(pdf);
                dataMap.forEach((value, key) => allPayslipData.set(key, value));
            } catch (pdfError) {
                 console.error(`Failed to process ${pdf.name}. Skipping.`, pdfError);
                 showError(`An error occurred while processing ${pdf.name}. It has been skipped.`);
            }
            count++;
        }
        
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

/**
 * Processes a single PDF file using the Gemini API.
 * @param {File} file The PDF file to process.
 * @returns {Promise<Map<string, any>>} A map of employee name to their payslip data.
 */
async function processPdf(file) {
    const base64File = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    // CORRECTED PROMPT: Asking for a structured object with fixed keys.
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

    // CORRECTED SCHEMA: This schema matches the new prompt and uses valid API fields.
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
    
    // CORRECTED PARSING LOGIC: Handles the new, structured response.
    const normalizedMap = new Map();
    if (parsedResult.employeeName && parsedResult.lineItems) {
        const name = parsedResult.employeeName.toUpperCase().trim();
        normalizedMap.set(name, parsedResult.lineItems);
    } else {
        console.warn("Parsed result was missing expected fields 'employeeName' or 'lineItems'", parsedResult);
    }
    return normalizedMap;
}

/**
 * Makes an API call to Gemini with exponential backoff retry logic.
 * @param {object} payload The payload to send to the API.
 * @param {number} maxRetries The maximum number of retries.
 * @returns {Promise<string>} The text response from the API.
 */
async function makeApiCallWithRetry(payload, maxRetries = 3) {
    const model = "gemini-1.5-flash-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    let delay = 1000; // Start with a 1-second delay

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


/**
 * Correlates the processed data and generates the final TSV output.
 */
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

/**
 * Displays warnings for any new, unrecognized codes found in the payslips.
 */
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

/**
 * Handles the click event for the 'ignore' button on a warning.
 * @param {MouseEvent} event The click event.
 */
function handleIgnoreClick(event) {
    if (!event.target.classList.contains('ignore-btn')) return;
    const codeToIgnore = event.target.dataset.code;
    
    ignoredCodes.add(String(codeToIgnore));
    updateIgnoredCodesInDb(ignoredCodes);
    
    newFoundCodes.delete(Number(codeToIgnore));
    
    // Remove the warning from the UI
    event.target.closest('.flex').remove();

    if (newFoundCodes.size === 0) {
        correlateAndGenerateOutput();
    }
}

/**
 * Creates and triggers a download for the generated TSV content.
 */
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
 * Shows or hides the main loader element.
 * @param {boolean} show True to show, false to hide.
 */
function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}

/**
 * Displays an error message to the user.
 * @param {string} message The message to display.
 */
function showError(message) {
    const errorEl = document.getElementById('payslip-error');
    errorEl.textContent = message;
    errorEl.style.display = message ? 'block' : 'none';
}
