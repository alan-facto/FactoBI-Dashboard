// This module handles the functionality for the "Tabelas" view.

/**
 * Sets up the event listeners for the table toggle buttons.
 * @param {HTMLElement} container - The main container for the tables view.
 */
function setupTableToggle(container) {
    const buttons = container.querySelectorAll('.table-toggle-btn');
    const tables = [
        { id: 'btn-summary-month', element: container.querySelector('#table-summary-month') },
        { id: 'btn-summary-department', element: container.querySelector('#table-summary-department') },
        { id: 'btn-detailed-month', element: container.querySelector('#table-detailed-month') },
        { id: 'btn-detailed-department', element: container.querySelector('#table-detailed-department') },
        { id: 'btn-earnings-table', element: container.querySelector('#table-earnings') }
    ];

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            // Update button styles
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Show the corresponding table and hide others
            tables.forEach(table => {
                if (table.element) {
                    table.element.style.display = table.id === button.id ? 'block' : 'none';
                }
            });
        });
    });
}

/**
 * Initializes the entire tables view.
 */
export function initTablesView() {
    // The fix: First, check if the main container for this view exists.
    const tablesViewContainer = document.getElementById('tables-view');
    if (!tablesViewContainer) {
        // If the container isn't on the page, don't try to initialize.
        // This prevents the "container is null" error during the initial app load.
        return;
    }

    // Pass the container to the setup function to ensure all querySelectors are scoped correctly.
    setupTableToggle(tablesViewContainer);

    // --- Initial Table Render (Placeholder Content) ---
    // This section can be expanded to render actual data tables.
    const summaryMonthContainer = tablesViewContainer.querySelector('#table-summary-month');
    if (summaryMonthContainer) {
        summaryMonthContainer.innerHTML = '<p class="p-4 text-gray-500">Tabela de resumo por mês será exibida aqui.</p>';
    }
    const summaryDeptContainer = tablesViewContainer.querySelector('#table-summary-department');
     if (summaryDeptContainer) {
        summaryDeptContainer.innerHTML = '<p class="p-4 text-gray-500">Tabela de resumo por departamento será exibida aqui.</p>';
    }
    // You can add similar placeholders for the other table containers.
}
