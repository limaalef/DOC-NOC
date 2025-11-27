// Sistema de Escalas - NOC IT Universe

let SHIFTS_DATA = {
    analysts: [],
    shifts: [],
    schedules: []
};

let currentWeekStart = new Date();

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await loadStoredData();
    Utils.initTheme();
    initEventListeners();
    setCurrentWeek();
    renderCalendar();
    renderAnalysts();
    renderLegend();
});

// Carregar dados da API
async function loadStoredData() {
    try {
        SHIFTS_DATA.analysts = await api.getAnalysts();
        SHIFTS_DATA.shifts = await api.getShifts();
        SHIFTS_DATA.schedules = await api.getSchedules();
        
        // Fallback para defaults se vazio
        if (SHIFTS_DATA.analysts.length === 0) {
            SHIFTS_DATA.analysts = getDefaultAnalysts();
        }
        if (SHIFTS_DATA.shifts.length === 0) {
            SHIFTS_DATA.shifts = getDefaultShifts();
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        SHIFTS_DATA.analysts = getDefaultAnalysts();
        SHIFTS_DATA.shifts = getDefaultShifts();
        SHIFTS_DATA.schedules = [];
    }
}

function getDefaultAnalysts() {
    return [
        { id: 1, name: "João Silva", role: "Analista NOC N1", phone: "+55 11 98765-4321", active: true },
        { id: 2, name: "Maria Santos", role: "Analista NOC N2", phone: "+55 11 98765-4322", active: true },
        { id: 3, name: "Pedro Costa", role: "Analista NOC N1", phone: "+55 11 98765-4323", active: true }
    ];
}

function getDefaultShifts() {
    return [
        { id: 1, name: "08h às 17h", start: "08:00", end: "17:00", color: "morning" },
        { id: 2, name: "09h às 18h", start: "09:00", end: "18:00", color: "afternoon" },
        { id: 3, name: "12x36 Diurno", start: "08:00", end: "20:00", color: "full" },
        { id: 4, name: "12x36 Noturno", start: "20:00", end: "08:00", color: "night" }
    ];
}

// Event Listeners
function initEventListeners() {
    document.getElementById('prev-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderCalendar();
    });

    document.getElementById('next-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderCalendar();
    });

    document.getElementById('today-btn').addEventListener('click', () => {
        setCurrentWeek();
        renderCalendar();
    });
}

function setCurrentWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() + diff);
    currentWeekStart.setHours(0, 0, 0, 0);
}

function renderCalendar() {
    const calendarBody = document.getElementById('calendar-body');
    const periodDisplay = document.getElementById('period-display');
    
    // Atualizar cabeçalho de datas
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        const dayElement = document.getElementById(`day-${i}`);
        if (dayElement) {
            dayElement.textContent = Utils.formatDate(date);
            
            const today = new Date();
            const dayHeader = dayElement.closest('.day-header');
            if (date.toDateString() === today.toDateString()) {
                dayHeader.classList.add('today');
            } else {
                dayHeader.classList.remove('today');
            }
        }
    }
    
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);
    periodDisplay.textContent = `Semana de ${Utils.formatDate(currentWeekStart)} a ${Utils.formatDate(weekEnd)} - ${Utils.formatFullDate(currentWeekStart).split(',')[1]}`;
    
    calendarBody.innerHTML = '';
    
    const schedulesByDate = {};
    SHIFTS_DATA.schedules.forEach(schedule => {
        if (!schedulesByDate[schedule.date]) {
            schedulesByDate[schedule.date] = [];
        }
        schedulesByDate[schedule.date].push(schedule);
    });
    
    const uniqueShifts = [...new Set(SHIFTS_DATA.shifts.map(s => s.id))];
    
    if (uniqueShifts.length === 0) {
        calendarBody.innerHTML = '<div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhum turno configurado.</div>';
        return;
    }
    
    uniqueShifts.forEach(shiftId => {
        const shift = SHIFTS_DATA.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        
        const timeSlot = document.createElement('div');
        timeSlot.className = 'time-slot';
        timeSlot.innerHTML = `<div><strong>${shift.name}</strong><br><small>${shift.start} - ${shift.end}</small></div>`;
        calendarBody.appendChild(timeSlot);
        
        for (let day = 0; day < 7; day++) {
            const cell = document.createElement('div');
            cell.className = 'shift-cell';
            
            if (day >= 5) cell.classList.add('weekend');
            
            const cellDate = new Date(currentWeekStart);
            cellDate.setDate(currentWeekStart.getDate() + day);
            const dateISO = Utils.formatDateISO(cellDate);
            
            const today = new Date();
            if (cellDate.toDateString() === today.toDateString()) {
                cell.classList.add('today');
            }
            
            const schedulesForDate = schedulesByDate[dateISO] || [];
            const schedule = schedulesForDate.find(s => s.shift === shiftId);
            
            if (schedule) {
                const analyst = SHIFTS_DATA.analysts.find(a => a.id === schedule.analyst);
                if (analyst) {
                    cell.classList.add('has-shift');
                    cell.innerHTML = `
                        <div class="shift-info">
                            <div class="shift-badge shift-${shift.color}">${shift.name}</div>
                            <div class="shift-analyst">${analyst.name}</div>
                            <div class="shift-time">${shift.start} - ${shift.end}</div>
                            <div class="shift-contact">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                </svg>
                                ${analyst.phone}
                            </div>
                        </div>
                    `;
                }
            } else {
                cell.innerHTML = '<div class="empty-shift">Sem escala</div>';
            }
            
            calendarBody.appendChild(cell);
        }
    });
}

function renderAnalysts() {
    const grid = document.getElementById('analysts-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (SHIFTS_DATA.analysts.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum analista cadastrado</div>';
        return;
    }
    
    SHIFTS_DATA.analysts
    .filter(analyst => analyst.active) // apenas ativos
    .forEach(analyst => {
        const initials = analyst.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        
        const card = document.createElement('div');
        card.className = 'analyst-card';
        card.innerHTML = `
            <div class="analyst-avatar">${initials}</div>
            <div class="analyst-info">
                <div class="analyst-name">${analyst.name}</div>
                <div class="analyst-role">${analyst.role}</div>
                <div class="analyst-contact">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    ${analyst.phone}
                </div>
            </div>
            <div class="analyst-status ${analyst.active ? 'active' : 'inactive'}"></div>
        `;
        
        grid.appendChild(card);
    });
}

function renderLegend() {
    const legendGrid = document.getElementById('legend-grid');
    if (!legendGrid) return;
    
    legendGrid.innerHTML = '';
    
    if (SHIFTS_DATA.shifts.length === 0) {
        legendGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 1rem; color: var(--text-secondary); font-size: 0.875rem;">Nenhum turno configurado</div>';
        return;
    }
    
    SHIFTS_DATA.shifts.forEach(shift => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color shift-${shift.color}"></div>
            <span>${shift.name} (${shift.start} - ${shift.end})</span>
        `;
        legendGrid.appendChild(item);
    });
}

window.SHIFTS_DATA = SHIFTS_DATA;
window.renderCalendar = renderCalendar;
