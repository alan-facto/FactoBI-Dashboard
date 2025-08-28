// This module handles the functionality for the "Eventos" view.

/**
 * Initializes the entire events view, including setting up
 * event listeners and performing the initial render.
 */
export function initEventsView() {
    // First, check if the main container for this view exists.
    const eventsViewContainer = document.getElementById('events-view');
    if (!eventsViewContainer) {
        // If the container isn't on the page, don't try to initialize the script.
        // This prevents errors when the app loads, as this script might run
        // before the user has navigated to the "Eventos" tab.
        console.warn('Events view container not found. Skipping initialization.');
        return;
    }

    // --- STATE ---
    // Holds the current date for calendar navigation.
    let currentDate = new Date();
    // Holds the list of currently selected categories for filtering.
    let selectedCategories = [];

    // --- DOM ELEMENTS (scoped to the eventsViewContainer) ---
    const agendaContainer = eventsViewContainer.querySelector('#agenda-container');
    const budgetsContainer = eventsViewContainer.querySelector('#budgets-container');
    const briefingsContainer = eventsViewContainer.querySelector('#briefings-container');
    const calendarWrapper = eventsViewContainer.querySelector('#calendar-wrapper');
    const listWrapper = eventsViewContainer.querySelector('#list-wrapper');
    const filterSidebar = eventsViewContainer.querySelector('#filter-sidebar');
    const toggleFiltersBtn = eventsViewContainer.querySelector('#toggle-filters-btn');
    const agendaWrapper = eventsViewContainer.querySelector('#agenda-wrapper');
    const calendarGrid = eventsViewContainer.querySelector('.calendar-grid');
    const currentMonthYearEl = eventsViewContainer.querySelector('#current-month-year');
    const legendFilterList = eventsViewContainer.querySelector('#legend-filter-list');
    
    // Global modals are not inside the view container
    const datePickerModal = document.getElementById('date-picker-modal');
    const monthSelect = document.getElementById('month-select');
    const yearInput = document.getElementById('year-input');
    
    // Configuration for main view toggles (Agenda, Budgets, Briefings)
    const viewToggles = [
        { btn: eventsViewContainer.querySelector('#view-toggle-agenda'), container: agendaContainer },
        { btn: eventsViewContainer.querySelector('#view-toggle-budgets'), container: budgetsContainer },
        { btn: eventsViewContainer.querySelector('#view-toggle-briefings'), container: briefingsContainer },
    ];
    
    // Configuration for sub-view toggles within Agenda (Calendar, List)
    const agendaViewToggles = [
        { btn: eventsViewContainer.querySelector('#agenda-view-calendar'), container: calendarWrapper },
        { btn: eventsViewContainer.querySelector('#agenda-view-list'), container: listWrapper },
    ];

    // --- MOCK DATA ---
    // This data will eventually be replaced with data from Firebase.
    const events = [
        { id: 1, date: '2025-08-29', title: 'Happy Hour Mensal', category: 'Confraternização' },
        { id: 2, date: '2025-08-12', title: 'Workshop de OKRs', category: 'Treinamento' },
        { id: 3, date: '2025-08-20', title: 'Reunião Geral', category: 'Corporativo' },
        { id: 4, date: '2025-08-20', title: 'Aniversário da Clara', category: 'Aniversariante' },
        { id: 5, date: '2025-09-07', title: 'Independência do Brasil', category: 'Feriado' },
        { id: 6, date: '2025-09-15', title: 'Workshop de Design Thinking', category: 'Workshop' },
    ];

    const categoryColors = {
        'Confraternização': 'bg-purple-500', 'Treinamento': 'bg-blue-500',
        'Corporativo': 'bg-green-500', 'Feriado': 'bg-yellow-500',
        'Aniversariante': 'bg-pink-500', 'Workshop': 'bg-indigo-500'
    };
    // Initially, all categories are selected.
    selectedCategories = Object.keys(categoryColors);

    // --- RENDER FUNCTIONS ---

    /**
     * Renders the calendar grid for the month specified in `currentDate`.
     */
    const renderCalendar = () => {
        if (!calendarGrid) return;
        // Header row for days of the week
        calendarGrid.innerHTML = `<div class="text-center font-semibold text-gray-500 p-2 border-r border-b text-xs sm:text-base">Dom</div><div class="text-center font-semibold text-gray-500 p-2 border-r border-b text-xs sm:text-base">Seg</div><div class="text-center font-semibold text-gray-500 p-2 border-r border-b text-xs sm:text-base">Ter</div><div class="text-center font-semibold text-gray-500 p-2 border-r border-b text-xs sm:text-base">Qua</div><div class="text-center font-semibold text-gray-500 p-2 border-r border-b text-xs sm:text-base">Qui</div><div class="text-center font-semibold text-gray-500 p-2 border-r border-b text-xs sm:text-base">Sex</div><div class="text-center font-semibold text-gray-500 p-2 border-r border-b text-xs sm:text-base">Sáb</div>`;
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
        currentMonthYearEl.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Add empty cells for days before the 1st of the month
        for (let i = 0; i < firstDay; i++) {
            calendarGrid.insertAdjacentHTML('beforeend', '<div class="calendar-day border-r border-b border-gray-200 bg-gray-50"></div>');
        }
        
        // Add a cell for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events.filter(e => e.date === dateStr);
            let eventsHtml = dayEvents.map(event => `<div class="event-bubble text-xs text-white ${categoryColors[event.category]} rounded p-1 mb-1" data-event-id="${event.id}">${event.title}</div>`).join('');
            calendarGrid.insertAdjacentHTML('beforeend', `<div class="calendar-day border-r border-b border-gray-200 p-1 flex flex-col" data-date="${dateStr}"><div class="font-semibold text-sm text-gray-700">${day}</div><div class="flex-1 min-h-0 event-list">${eventsHtml}</div></div>`);
        }
        
        // Initialize drag-and-drop functionality for events
        eventsViewContainer.querySelectorAll('.event-list').forEach(el => new Sortable(el, { 
            group: 'shared', 
            animation: 150,
            onEnd: (evt) => {
                const event = events.find(e => e.id == evt.item.dataset.eventId);
                if(event) {
                    event.date = evt.to.parentElement.dataset.date;
                    console.log(`Event "${event.title}" moved to ${event.date}`);
                }
            }
        }));
    };
    
    /**
     * Renders the list view for the month specified in `currentDate`,
     * filtered by `selectedCategories`.
     */
    const renderListView = () => {
        if (!listWrapper) return;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const filteredEvents = events
            .filter(e => selectedCategories.includes(e.category))
            .filter(e => {
                const eventDate = new Date(e.date + 'T00:00:00');
                return eventDate.getFullYear() === year && eventDate.getMonth() === month;
            })
            .sort((a,b) => new Date(a.date) - new Date(b.date));
            
        if (filteredEvents.length === 0) {
            listWrapper.innerHTML = `<p class="text-center text-gray-500 mt-8">Nenhum evento para este mês.</p>`;
            return;
        }

        listWrapper.innerHTML = filteredEvents.map(event => {
            const eventDate = new Date(event.date + 'T00:00:00');
            const today = new Date();
            today.setHours(0,0,0,0);
            let statusHtml = '';
            if (eventDate < today) {
                statusHtml = `<div class="flex items-center gap-2 text-green-600 bg-green-100 px-3 py-1 rounded-full text-sm font-semibold"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg><span>Realizado</span></div>`;
            } else {
                 statusHtml = `<div class="flex items-center gap-2 text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full text-sm font-semibold"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clip-rule="evenodd"></path></svg><span>Próximo</span></div>`;
            }
            return `
                <div class="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="text-center w-16">
                            <p class="text-3xl font-bold text-[#024B59]">${eventDate.getDate()}</p>
                            <p class="text-sm text-gray-500">${eventDate.toLocaleString('pt-BR', { month: 'short' }).toUpperCase()}</p>
                        </div>
                        <div>
                            <p class="font-bold text-lg text-gray-800">${event.title}</p>
                            <p class="text-sm text-gray-600">${event.category}</p>
                        </div>
                    </div>
                    ${statusHtml}
                </div>`;
        }).join('');
    };

    /**
     * Renders the category legend/filter in the sidebar.
     */
    const renderLegend = () => {
        if (!legendFilterList) return;
        legendFilterList.innerHTML = Object.entries(categoryColors).map(([category, colorClass]) => `
            <div class="flex items-center gap-2 cursor-pointer legend-item ${selectedCategories.includes(category) ? '' : 'opacity-40'}" data-category="${category}">
                <span class="w-4 h-4 rounded-full ${colorClass}"></span> ${category}
            </div>
        `).join('');
    };

    // --- EVENT LISTENERS ---
    
    // Main view toggles (Agenda, Budgets, Briefings)
    viewToggles.forEach(toggle => {
        if (!toggle.btn) return;
        toggle.btn.addEventListener('click', () => {
            viewToggles.forEach(t => {
                t.container.classList.add('hidden');
                t.btn.classList.remove('bg-white', 'text-[#024B59]');
                t.btn.classList.add('text-white');
            });
            toggle.container.classList.remove('hidden');
            toggle.btn.classList.add('bg-white', 'text-[#024B59]');
            toggle.btn.classList.remove('text-white');
            
            const isAgenda = toggle.container === agendaContainer;
            toggleFiltersBtn.style.display = isAgenda ? 'flex' : 'none';
            if (!isAgenda && filterSidebar.classList.contains('w-56')) {
                 toggleFiltersBtn.click(); // Close sidebar if not on agenda view
            }
        });
    });
    
    // Agenda sub-view toggles (Calendar, List)
    agendaViewToggles.forEach(toggle => {
        if (!toggle.btn) return;
        toggle.btn.addEventListener('click', () => {
             agendaViewToggles.forEach(t => {
                t.container.classList.add('hidden');
                t.btn.classList.remove('bg-white', 'text-[#024B59]');
                t.btn.classList.add('text-gray-600');
            });
            toggle.container.classList.remove('hidden');
            toggle.btn.classList.add('bg-white', 'text-[#024B59]');
            toggle.btn.classList.remove('text-gray-600');
            renderListView(); // Re-render list when toggling
        });
    });

    // Calendar navigation
    eventsViewContainer.querySelector('#prev-month')?.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); renderListView(); });
    eventsViewContainer.querySelector('#next-month')?.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); renderListView(); });
    
    // Filter sidebar toggle
    toggleFiltersBtn?.addEventListener('click', () => {
        filterSidebar.classList.toggle('w-0');
        filterSidebar.classList.toggle('w-56');
        filterSidebar.classList.toggle('p-0');
        filterSidebar.classList.toggle('p-6');
        // Adjust the width of the agenda wrapper to make space for the sidebar
        if (filterSidebar.classList.contains('w-56')) {
            agendaWrapper.style.width = `calc(100% - 16rem)`; 
        } else {
            agendaWrapper.style.width = '100%';
        }
    });

    // Date picker modal setup
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    if (monthSelect) monthSelect.innerHTML = months.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    
    currentMonthYearEl?.addEventListener('click', () => { 
        if(monthSelect) monthSelect.value = currentDate.getMonth();
        if(yearInput) yearInput.value = currentDate.getFullYear();
        datePickerModal?.classList.remove('hidden');
        datePickerModal?.classList.add('flex'); 
    });
    document.getElementById('cancel-date-picker')?.addEventListener('click', () => datePickerModal.classList.add('hidden'));
    document.getElementById('go-to-date')?.addEventListener('click', () => { 
        currentDate = new Date(yearInput.value, monthSelect.value, 1); 
        renderCalendar(); 
        renderListView();
        datePickerModal.classList.add('hidden'); 
    });

    // Legend filter click handler
    legendFilterList?.addEventListener('click', (e) => {
        const item = e.target.closest('.legend-item');
        if (item) {
            const category = item.dataset.category;
            const index = selectedCategories.indexOf(category);
            if (index > -1) {
                selectedCategories.splice(index, 1); // Remove if exists
            } else {
                selectedCategories.push(category); // Add if not
            }
            item.classList.toggle('opacity-40');
            renderListView(); // Update list view with new filters
        }
    });

    // --- INITIAL RENDER ---
    renderCalendar();
    renderLegend();
    renderListView();
}
