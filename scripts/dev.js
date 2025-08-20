export function initDevView() {
    const viewContainer = document.getElementById('dev-view');
    if (!viewContainer) {
        console.error("Dev view container not found!");
        return;
    }

    // --- Tab Management ---
    const mainTabs = ['upload', 'edit', 'delete'];
    window.showTab = (tabId) => {
        mainTabs.forEach(id => {
            const tabContent = document.getElementById(`${id}-tab`);
            const tabButton = document.getElementById(`tab-btn-${id}`);
            if (tabContent && tabButton) {
                tabContent.style.display = (id === tabId) ? 'block' : 'none';
                tabButton.classList.toggle('active', id === tabId);
            }
        });
    };

    const inputMethods = ['file', 'paste'];
    window.showInputMethod = (methodId) => {
        inputMethods.forEach(id => {
            const methodContent = document.getElementById(`${id}-input-method`);
            const methodButton = document.getElementById(`input-method-btn-${id}`);
            if (methodContent && methodButton) {
                methodContent.style.display = (id === methodId) ? 'block' : 'none';
                methodButton.classList.toggle('active', id === methodId);
            }
        });
    };

    // --- Modal Management ---
    window.openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.style.opacity = 1, 10);
        }
    };
    window.closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.opacity = 0;
            setTimeout(() => modal.style.display = 'none', 300);
        }
    };

    // --- Interactive Logic ---
    // Accordion logic for validation modal
    viewContainer.querySelectorAll("details summary").forEach(summary => {
        summary.addEventListener("click", e => {
            const detail = summary.parentElement;
            const icon = summary.querySelector("svg");
            if (detail.hasAttribute("open")) {
                e.preventDefault();
                detail.removeAttribute("open");
                icon.style.transform = "rotate(0deg)";
            } else {
                icon.style.transform = "rotate(-180deg)";
            }
        });
    });

    // Confirmation input for deleting all data
    const deleteConfirmInput = document.getElementById('delete-confirm-input');
    const finalDeleteBtn = document.getElementById('final-delete-btn');
    if (deleteConfirmInput && finalDeleteBtn) {
        deleteConfirmInput.addEventListener('input', () => {
            finalDeleteBtn.disabled = (deleteConfirmInput.value !== 'EXCLUIR');
        });
    }

    // Logic to enable save button on edit
    const saveChangesBtn = document.getElementById('save-changes-btn');
    const statusIndicator = document.getElementById('status-indicator');
    if (saveChangesBtn && statusIndicator) {
        viewContainer.querySelectorAll('[contenteditable="true"]').forEach(cell => {
            cell.addEventListener('input', () => {
                saveChangesBtn.disabled = false;
                statusIndicator.innerHTML = `
                    <span class="status-dot-wrapper"><span class="status-dot-active"></span></span>
                    Alterações não salvas
                `;
                statusIndicator.classList.add('unsaved');
            });
        });
    }

    console.log("Dev View Initialized");
}
