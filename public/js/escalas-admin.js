// Administração de Escalas - NOC IT Universe

// Dados
let analystsData = [];
let schedulesData = [];
let shiftsConfig = [];
let currentAnalyst = null;
let currentShift = null;
let currentTab = 'analyst';
let nextAnalystId = 1;
let nextShiftId = 1;

const DAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    Utils.initTheme();
    initEventListeners();
    renderAnalystsList();
    renderShiftsList();
    populateAnalystsSelect();
    populateShiftsSelect();
    renderSchedulePreview();
});

// Carregar dados da API
async function loadData() {
    try {
        analystsData = await api.getAnalysts();
        shiftsConfig = await api.getShifts();
        schedulesData = await api.getSchedules();
        
        // Calcular próximos IDs
        if (analystsData.length > 0) {
            nextAnalystId = Math.max(...analystsData.map(a => a.id)) + 1;
        }
        if (shiftsConfig.length > 0) {
            nextShiftId = Math.max(...shiftsConfig.map(s => s.id)) + 1;
        }
        
        // Fallback para defaults se vazio
        if (analystsData.length === 0) {
            analystsData = getDefaultAnalysts();
            await saveAnalystsData();
        }
        if (shiftsConfig.length === 0) {
            shiftsConfig = getDefaultShifts();
            await saveShiftsData();
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        analystsData = getDefaultAnalysts();
        shiftsConfig = getDefaultShifts();
        schedulesData = [];
    }
}

// Analistas padrão
function getDefaultAnalysts() {
    return [
        { id: 1, name: "João Silva", role: "Analista NOC N1", phone: "+55 11 98765-4321", email: "joao.silva@ituniverse.com.br", active: true },
        { id: 2, name: "Maria Santos", role: "Analista NOC N2", phone: "+55 11 98765-4322", email: "maria.santos@ituniverse.com.br", active: true },
        { id: 3, name: "Pedro Costa", role: "Analista NOC N1", phone: "+55 11 98765-4323", email: "pedro.costa@ituniverse.com.br", active: true }
    ];
}

// Turnos padrão
function getDefaultShifts() {
    return [
        { id: 1, name: "08h às 17h", start: "08:00", end: "17:00", color: "morning" },
        { id: 2, name: "09h às 18h", start: "09:00", end: "18:00", color: "afternoon" },
        { id: 3, name: "12x36 Diurno", start: "08:00", end: "20:00", color: "full" },
        { id: 4, name: "12x36 Noturno", start: "20:00", end: "08:00", color: "night" }
    ];
}

// Salvar dados via API
async function saveAnalystsData() {
    try {
        await api.saveAnalysts(analystsData);
    } catch (error) {
        console.error('Erro ao salvar analistas:', error);
        Utils.showAlert('Erro ao salvar analistas', 'danger');
    }
}

async function saveSchedulesData() {
    try {
        await api.saveSchedules(schedulesData);
    } catch (error) {
        console.error('Erro ao salvar escalas:', error);
        Utils.showAlert('Erro ao salvar escalas', 'danger');
    }
}

async function saveShiftsData() {
    try {
        await api.saveShifts(shiftsConfig);
    } catch (error) {
        console.error('Erro ao salvar turnos:', error);
        Utils.showAlert('Erro ao salvar turnos', 'danger');
    }
}

// Event Listeners
function initEventListeners() {
    const analystForm = document.getElementById('analyst-form');
    const shiftForm = document.getElementById('shift-form');
    const scheduleForm = document.getElementById('schedule-form');
    
    if (analystForm) analystForm.addEventListener('submit', saveAnalyst);
    if (shiftForm) shiftForm.addEventListener('submit', saveShift);
    if (scheduleForm) scheduleForm.addEventListener('submit', saveSchedule);
}

// Tabs
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes(tab)) {
            btn.classList.add('active');
        }
    });
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const tabContent = document.getElementById(`tab-${tab}`);
    if (tabContent) tabContent.classList.add('active');
}

// ===== ANALISTAS =====
function renderAnalystsList() {
    const list = document.getElementById('analysts-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (analystsData.length === 0) {
        list.innerHTML = '<div class="loading">Nenhum analista cadastrado</div>';
        return;
    }
    
    analystsData.forEach(analyst => {
        const item = document.createElement('div');
        item.className = 'pop-list-item';
        if (currentAnalyst && currentAnalyst.id === analyst.id) item.classList.add('active');
        
        const statusDot = analyst.active ? '<span style="color: var(--accent-green); margin-left: 0.5rem;">●</span>' : '';
        item.innerHTML = `
            <div class="pop-list-item-info">
                <h4>${analyst.name}${statusDot}</h4>
                <p><span class="badge ${analyst.active ? 'badge-green' : 'badge-orange'}">${analyst.role}</span></p>
            </div>
        `;
        
        item.addEventListener('click', () => {
            document.querySelectorAll('#analysts-list .pop-list-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            loadAnalystToForm(analyst);
        });
        
        list.appendChild(item);
    });
}

function newAnalyst() {
    currentAnalyst = null;
    clearAnalystForm();
    document.getElementById('form-analyst-title').textContent = 'Novo Analista';
    document.getElementById('delete-analyst-btn').style.display = 'none';
    document.querySelectorAll('#analysts-list .pop-list-item').forEach(el => el.classList.remove('active'));
    switchTab('analyst');
}

function loadAnalystToForm(analyst) {
    currentAnalyst = analyst;
    document.getElementById('form-analyst-title').textContent = 'Editar Analista';
    document.getElementById('analyst-name').value = analyst.name;
    document.getElementById('analyst-role').value = analyst.role;
    document.getElementById('analyst-phone').value = analyst.phone;
    document.getElementById('analyst-email').value = analyst.email || '';
    const statusInput = document.querySelector(`input[name="analyst-status"][value="${analyst.active ? 'active' : 'inactive'}"]`);
    if (statusInput) statusInput.checked = true;
    document.getElementById('delete-analyst-btn').style.display = 'inline-flex';
    switchTab('analyst');
}

function clearAnalystForm() {
    const form = document.getElementById('analyst-form');
    if (form) form.reset();
    currentAnalyst = null;
    document.getElementById('form-analyst-title').textContent = 'Novo Analista';
    document.getElementById('delete-analyst-btn').style.display = 'none';
}

async function saveAnalyst(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('analyst-name').value.trim(),
        role: document.getElementById('analyst-role').value,
        phone: document.getElementById('analyst-phone').value.trim(),
        email: document.getElementById('analyst-email').value.trim(),
        active: document.querySelector('input[name="analyst-status"]:checked').value === 'active'
    };
    
    if (!data.name || !data.role || !data.phone) {
        Utils.showAlert('Preencha todos os campos obrigatórios!', 'danger');
        return;
    }
    
    try {
        if (currentAnalyst) {
            const index = analystsData.findIndex(a => a.id === currentAnalyst.id);
            if (index >= 0) {
                analystsData[index] = { ...currentAnalyst, ...data };
                Utils.showAlert(`Analista "${data.name}" atualizado!`, 'success');
            }
        } else {
            data.id = nextAnalystId++;
            analystsData.push(data);
            Utils.showAlert(`Analista "${data.name}" cadastrado!`, 'success');
        }
        
        await saveAnalystsData();
        renderAnalystsList();
        populateAnalystsSelect();
        clearAnalystForm();
    } catch (error) {
        console.error('Erro ao salvar analista:', error);
        Utils.showAlert('Erro ao salvar analista', 'danger');
    }
}

async function deleteAnalyst() {
    if (!currentAnalyst) return;
    if (confirm(`Excluir "${currentAnalyst.name}"?`)) {
        try {
            analystsData = analystsData.filter(a => a.id !== currentAnalyst.id);
            schedulesData = schedulesData.filter(s => s.analyst !== currentAnalyst.id);
            
            await saveAnalystsData();
            await saveSchedulesData();
            
            Utils.showAlert('Analista excluído!', 'success');
            clearAnalystForm();
            renderAnalystsList();
            populateAnalystsSelect();
            renderSchedulePreview();
        } catch (error) {
            console.error('Erro ao excluir analista:', error);
            Utils.showAlert('Erro ao excluir analista', 'danger');
        }
    }
}

function populateAnalystsSelect() {
    const select = document.getElementById('schedule-analyst');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione...</option>';
    analystsData.filter(a => a.active).forEach(analyst => {
        const option = document.createElement('option');
        option.value = analyst.id;
        option.textContent = `${analyst.name} (${analyst.role})`;
        select.appendChild(option);
    });
}

// ===== TURNOS =====
function renderShiftsList() {
    const list = document.getElementById('shifts-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (shiftsConfig.length === 0) {
        list.innerHTML = '<div class="loading">Nenhum turno cadastrado</div>';
        return;
    }
    
    shiftsConfig.forEach(shift => {
        const item = document.createElement('div');
        item.className = 'pop-list-item';
        if (currentShift && currentShift.id === shift.id) item.classList.add('active');
        
        item.innerHTML = `
            <div class="pop-list-item-info">
                <h4>${shift.name}</h4>
                <p><span class="shift-badge shift-${shift.color}">${shift.start} - ${shift.end}</span></p>
            </div>
        `;
        
        item.addEventListener('click', () => {
            document.querySelectorAll('#shifts-list .pop-list-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            loadShiftToForm(shift);
        });
        
        list.appendChild(item);
    });
}

function newShift() {
    currentShift = null;
    clearShiftForm();
    document.getElementById('form-shift-title').textContent = 'Novo Turno';
    document.getElementById('delete-shift-btn').style.display = 'none';
    document.querySelectorAll('#shifts-list .pop-list-item').forEach(el => el.classList.remove('active'));
    switchTab('shifts');
}

function loadShiftToForm(shift) {
    currentShift = shift;
    document.getElementById('form-shift-title').textContent = 'Editar Turno';
    document.getElementById('shift-name').value = shift.name;
    document.getElementById('shift-start').value = shift.start;
    document.getElementById('shift-end').value = shift.end;
    document.getElementById('shift-color').value = shift.color;
    document.getElementById('delete-shift-btn').style.display = 'inline-flex';
    switchTab('shifts');
}

function clearShiftForm() {
    const form = document.getElementById('shift-form');
    if (form) form.reset();
    currentShift = null;
    document.getElementById('form-shift-title').textContent = 'Novo Turno';
    document.getElementById('delete-shift-btn').style.display = 'none';
}

async function saveShift(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('shift-name').value.trim(),
        start: document.getElementById('shift-start').value,
        end: document.getElementById('shift-end').value,
        color: document.getElementById('shift-color').value
    };
    
    if (!data.name || !data.start || !data.end) {
        Utils.showAlert('Preencha todos os campos!', 'danger');
        return;
    }
    
    try {
        if (currentShift) {
            const index = shiftsConfig.findIndex(s => s.id === currentShift.id);
            if (index >= 0) {
                shiftsConfig[index] = { ...currentShift, ...data };
                Utils.showAlert(`Turno "${data.name}" atualizado!`, 'success');
            }
        } else {
            data.id = nextShiftId++;
            shiftsConfig.push(data);
            Utils.showAlert(`Turno "${data.name}" cadastrado!`, 'success');
        }
        
        await saveShiftsData();
        renderShiftsList();
        populateShiftsSelect();
        clearShiftForm();
    } catch (error) {
        console.error('Erro ao salvar turno:', error);
        Utils.showAlert('Erro ao salvar turno', 'danger');
    }
}

async function deleteShift() {
    if (!currentShift) return;
    if (confirm(`Excluir turno "${currentShift.name}"?`)) {
        try {
            shiftsConfig = shiftsConfig.filter(s => s.id !== currentShift.id);
            schedulesData = schedulesData.filter(sc => sc.shift !== currentShift.id);
            
            await saveShiftsData();
            await saveSchedulesData();
            
            Utils.showAlert('Turno excluído!', 'success');
            clearShiftForm();
            renderShiftsList();
            populateShiftsSelect();
            renderSchedulePreview();
        } catch (error) {
            console.error('Erro ao excluir turno:', error);
            Utils.showAlert('Erro ao excluir turno', 'danger');
        }
    }
}

function populateShiftsSelect() {
    const select = document.getElementById('schedule-shift');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione...</option>';
    shiftsConfig.forEach(shift => {
        const option = document.createElement('option');
        option.value = shift.id;
        option.textContent = `${shift.name} (${shift.start} - ${shift.end})`;
        select.appendChild(option);
    });
}

// ===== ESCALAS =====
function clearScheduleForm() {
    const form = document.getElementById('schedule-form');
    if (form) form.reset();
}

async function saveSchedule(e) {
    e.preventDefault();
    
    const date = document.getElementById('schedule-date').value;
    const shiftId = parseInt(document.getElementById('schedule-shift').value);
    const analystId = parseInt(document.getElementById('schedule-analyst').value);
    
    if (!date || isNaN(shiftId) || isNaN(analystId)) {
        Utils.showAlert('Preencha todos os campos!', 'danger');
        return;
    }
    
    const analyst = analystsData.find(a => a.id === analystId);
    const shift = shiftsConfig.find(s => s.id === shiftId);
    
    if (!analyst || !shift) {
        Utils.showAlert('Analista ou turno inválido!', 'danger');
        return;
    }
    
    try {
        const existingIndex = schedulesData.findIndex(s => s.date === date && s.shift === shiftId);
        const scheduleData = { date, shift: shiftId, analyst: analystId };
        
        if (existingIndex >= 0) {
            schedulesData[existingIndex] = scheduleData;
            Utils.showAlert('Escala atualizada!', 'success');
        } else {
            schedulesData.push(scheduleData);
            Utils.showAlert('Escala cadastrada!', 'success');
        }
        
        await saveSchedulesData();
        clearScheduleForm();
        renderSchedulePreview();
    } catch (error) {
        console.error('Erro ao salvar escala:', error);
        Utils.showAlert('Erro ao salvar escala', 'danger');
    }
}

function renderSchedulePreview() {
    const preview = document.getElementById('schedule-preview');
    if (!preview) return;
    preview.innerHTML = '';
    
    if (schedulesData.length === 0) {
        preview.innerHTML = '<div class="empty-shift">Nenhuma escala cadastrada</div>';
        return;
    }
    
    const byDate = {};
    schedulesData.forEach(schedule => {
        if (!byDate[schedule.date]) byDate[schedule.date] = [];
        byDate[schedule.date].push(schedule);
    });
    
    Object.keys(byDate).sort().forEach(date => {
        const dateDiv = document.createElement('div');
        dateDiv.style.marginBottom = '1.5rem';
        
        const dateObj = new Date(date + 'T12:00:00');
        const dayName = DAYS[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1];
        
        dateDiv.innerHTML = `
            <h5 style="margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color); color: var(--text-primary);">
                ${dayName} - ${date.split('-').reverse().join('/')}
            </h5>
            <div class="shifts-container" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
        `;
        
        const shiftsContainer = dateDiv.querySelector('.shifts-container');
        
        byDate[date].forEach(schedule => {
            const analyst = analystsData.find(a => a.id === schedule.analyst);
            const shift = shiftsConfig.find(s => s.id === schedule.shift);
            if (!analyst || !shift) return;
            
            const shiftDiv = document.createElement('div');
            shiftDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background-color: var(--bg-tertiary); border-radius: 0.375rem; border: 1px solid var(--border-color);';
            shiftDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                    <span class="shift-badge shift-${shift.color}">${shift.name}</span>
                    <div>
                        <div style="font-weight: 600; font-size: 0.875rem; color: var(--text-primary);">${analyst.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${shift.start} - ${shift.end}</div>
                    </div>
                </div>
                <button type="button" class="btn btn-danger btn-icon" onclick="deleteSchedule('${schedule.date}', ${schedule.shift})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            `;
            shiftsContainer.appendChild(shiftDiv);
        });
        
        preview.appendChild(dateDiv);
    });
}

async function deleteSchedule(date, shiftId) {
    if (confirm('Remover esta escala?')) {
        try {
            schedulesData = schedulesData.filter(s => !(s.date === date && s.shift === shiftId));
            await saveSchedulesData();
            Utils.showAlert('Escala removida!', 'success');
            renderSchedulePreview();
        } catch (error) {
            console.error('Erro ao remover escala:', error);
            Utils.showAlert('Erro ao remover escala', 'danger');
        }
    }
}

// Exportar funções globais
window.switchTab = switchTab;
window.newAnalyst = newAnalyst;
window.clearAnalystForm = clearAnalystForm;
window.deleteAnalyst = deleteAnalyst;
window.newShift = newShift;
window.clearShiftForm = clearShiftForm;
window.deleteShift = deleteShift;
window.clearScheduleForm = clearScheduleForm;
window.deleteSchedule = deleteSchedule;
window.changeSidebarView = function(view) {
    if (view === 'analysts') {
        document.getElementById('sidebar-analysts').style.display = 'block';
        document.getElementById('sidebar-shifts').style.display = 'none';
    } else {
        document.getElementById('sidebar-analysts').style.display = 'none';
        document.getElementById('sidebar-shifts').style.display = 'block';
    }
};