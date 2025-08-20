// scripts/payslip.js

// Import Firebase functions from main.js where they are already initialized
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app } from './main.js'; // Assuming 'app' is exported from main.js for db initialization

// --- Module State ---
let db;
let nameList = [];
let payslipData = new Map();
let newFoundCodes = new Map();
let ignoredCodes = new Set();

const IGNORED_CODES_DOC_PATH = "payslipProcessor/ignoredCodes";

// --- DOM Elements ---
let fileInput, dropZone, loader, outputSection, outputTextarea, warningSection, warningList, downloadBtn;

/**
 * Initializes the payslip processor module and sets up event listeners.
 */
export function initPayslipProcessor() {
    // Initialize Firestore DB instance
    db = getFirestore(app);

    // Cache DOM elements
    fileInput = document.getElementById('payslip-file-upload');
    dropZone = document.getElementById('payslip-drop-zone');
    loader = document.getElementById('payslip-loader');
    outputSection = document.getElementById('payslip-output-section');
    outputTextarea = document.getElementById('payslip-output');
    warningSection = document.getElementById('payslip-warning-section');
    warningList = document.getElementById('payslip-warning-list');
    downloadBtn = document.getElementById('payslip-download-btn');

    if (!fileInput) {
        console.log("Payslip processor elements not found, skipping initialization.");
        return;
    }

    // --- Event Listeners ---
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            handleFileUploads(Array.from(fileInput.files));
        }
    });
    fileInput.addEventListener('change', () => handleFileUploads(Array.from(fileInput.files)));
    warningSection.addEventListener('click', handleIgnoreClick);
    downloadBtn.addEventListener('click', downloadTsv);

    // Fetch initial ignored codes
    fetchIgnoredCodes();
    console.log("Payslip Processor Initialized");
}

/**
 * Fetches the list of ignored codes from localStorage and Firestore.
 */
async function fetchIgnoredCodes() {
    const localIgnored = JSON.parse(localStorage.getItem('ignoredPayslipCodes')) || [];
    let combinedIgnored = new Set(localIgnored);

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

/**
 * Saves the updated set of ignored codes to Firestore.
 */
async function updateIgnoredCodesInDb(updatedCodesSet) {
    if (!db) return;
    try {
        const docRef = doc(db, IGNORED_CODES_DOC_PATH);
        await setDoc(docRef, { codes: Array.from(updatedCodesSet) });
        console.log("Updated ignored codes in Firebase.");
    } catch (err) {
        console.error("Error updating ignored codes:", err);
        showError("Could not save ignored codes to Firebase.");
    }
}

/**
 * Main handler for processing uploaded files.
 */
async function handleFileUploads(files) {
    showLoader(true);
    showError('');
    outputSection.style.display = 'none';
    warningSection.style.display = 'none';
    newFoundCodes.clear();

    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    const tsvFile = files.find(f => f.type === 'text/tab-separated-values' || f.name.endsWith('.tsv'));

    if (pdfFiles.length === 0 || !tsvFile) {
        showError("Please upload at least one PDF and one TSV file.");
        showLoader(false);
        return;
    }

    try {
        const namesText = await tsvFile.text();
        nameList = namesText.split('\n').map(n => n.trim()).filter(Boolean);

        const allPayslipData = new Map();
        for (const pdf of pdfFiles) {
            const data = await processPdf(pdf);
            data.forEach((value, key) => allPayslipData.set(key, value));
        }
        payslipData = allPayslipData;

        correlateAndGenerateOutput();
    } catch (err) {
        console.error("File processing error:", err);
        showError(`An error occurred: ${err.message}`);
    } finally {
        showLoader(false);
    }
}

/**
 * Converts a PDF file to base64 and sends it to the Gemini API for processing.
 */
async function processPdf(file) {
    const base64File = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    const prompt = `
        For each page in this PDF, identify the employee's full name, which is usually in a large font above the main table.
        Then, extract all line items from the payslip table on that page. For each item, provide its code ('Código'), description ('Descrição'), 'Vencimentos' (Earnings), and 'Descontos' (Deductions).
        Return the data as a JSON object where keys are the employee names and values are arrays of their line items.
        Ensure all monetary values are numbers, using a period as the decimal separator.
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
                        }
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

/**
 * Makes a fetch request to the Gemini API with exponential backoff.
 */
async function makeApiCallWithRetry(payload, maxRetries = 3) {
    // This function should use the actual API call logic.
    // NOTE: This is a MOCK response for demonstration purposes.
    // Replace with your actual fetch logic to the Gemini API.
    console.log("Making API call (mock)...");
    return new Promise(resolve => setTimeout(() => {
        const mockData = {
            "ALAN MARTINS RODRIGUES": [
                { "codigo": 1, "descricao": "HORAS NORMAIS", "vencimentos": 2600.00, "descontos": 0 },
                { "codigo": 150, "descricao": "HORAS EXTRAS", "vencimentos": 9.04, "descontos": 0 },
                { "codigo": 998, "descricao": "I.N.S.S.", "vencimentos": 0, "descontos": 210.78 },
                { "codigo": 8069, "descricao": "HORAS FALTAS PARCIAL", "vencimentos": 0, "descontos": 15.36 },
                { "codigo": 9999, "descricao": "NEW UNKNOWN BENEFIT", "vencimentos": 100.00, "descontos": 0 }
            ]
        };
        resolve(JSON.stringify(mockData));
    }, 1500));
}

/**
 * Correlates data and generates the TSV output or displays warnings.
 */
function correlateAndGenerateOutput() {
    const tsvRows = [];
    const header = "Nome\tComissão\tVale Adiantamento\tVT Desconto\tSalário Família\tDesconto Empréstimo\tHoras Extras\tDesconto Faltas";
    tsvRows.push(header);

    const foundCodes = new Map();

    nameList.forEach(name => {
        const personData = payslipData.get(name.toUpperCase().trim());
        let rowData = { comissao: 0, valeAdiantamento: 0, vtDesconto: 0, salarioFamilia: 0, descontoEmprestimo: 0, horasExtrasValor: 0, descontoFaltas: 0 };

        if (personData) {
            personData.forEach(item => {
                const desc = item.descricao.toUpperCase();
                const codigo = item.codigo || 0;
                let processed = false;

                if (desc.includes('COMISS')) { rowData.comissao += item.vencimentos || 0; processed = true; }
                if (desc.includes('EXTRAS')) { rowData.horasExtrasValor += item.vencimentos || 0; processed = true; }
                if (desc.includes('FALTAS')) { rowData.descontoFaltas += item.descontos || 0; processed = true; }
                if (desc.includes('VALE TRANSPORTE') || desc.includes('VT')) { rowData.vtDesconto += item.descontos || 0; processed = true; }
                if (desc.includes('ADIANTAMENTO') || codigo === 981) { rowData.valeAdiantamento += item.descontos || 0; processed = true; }
                if (desc.includes('SALARIO FAMILIA')) { rowData.salarioFamilia += item.vencimentos || 0; processed = true; }
                if (desc.includes('EMPRESTIMO') || desc.includes('DESC. EMP')) { rowData.descontoEmprestimo += item.descontos || 0; processed = true; }

                if (!processed && !ignoredCodes.has(String(codigo)) && (item.vencimentos > 0 || item.descontos > 0)) {
                    if (!foundCodes.has(codigo)) {
                        foundCodes.set(codigo, item.descricao);
                    }
                }
            });
        }

        const formatValue = (value) => value.toFixed(2).replace('.', ',');
        const row = [
            name,
            formatValue(rowData.comissao), formatValue(rowData.valeAdiantamento), formatValue(rowData.vtDesconto),
            formatValue(rowData.salarioFamilia), formatValue(rowData.descontoEmprestimo),
            formatValue(rowData.horasExtrasValor), formatValue(rowData.descontoFaltas)
        ].join('\t');
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
 * Renders the warnings for any new, unrecognized codes found.
 */
function displayWarnings() {
    warningList.innerHTML = '';
    if (newFoundCodes.size === 0) {
        warningSection.style.display = 'none';
        return;
    }
    newFoundCodes.forEach((desc, code) => {
        const warningEl = document.createElement('div');
        warningEl.className = 'flex items-center justify-between text-sm py-1';
        warningEl.innerHTML = `
            <span><strong class="font-semibold">Code ${code}:</strong> ${desc}</span>
            <button data-code="${code}" class="ignore-btn dev-btn btn-tertiary">
                Ignore
            </button>
        `;
        warningList.appendChild(warningEl);
    });
    warningSection.style.display = 'block';
}

/**
 * Handles the click event for ignoring a new code.
 */
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

/**
 * Triggers the download of the generated TSV content.
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

// --- UI Helpers ---
function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const errorEl = document.getElementById('payslip-error');
    if (message) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    } else {
        errorEl.style.display = 'none';
    }
}
