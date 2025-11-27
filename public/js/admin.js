// Configuração de clientes
const CLIENTS = ['caldic', 'ituniverse', 'softys'];

// Estado da aplicação
let currentClient = '';
let currentPOP = null;
let isEditMode = false;
let allPOPs = {};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventListeners();
    loadClients();
    
    const clientFromURL = Utils.getURLParameter('client');
    const popFromURL = Utils.getURLParameter('pop');
    
    if (clientFromURL) {
        const normalizedClient = clientFromURL.toLowerCase();
        
        if (CLIENTS.includes(normalizedClient)) {
            setTimeout(() => {
                const clientSelect = document.getElementById('client-select');
                clientSelect.value = normalizedClient;
                currentClient = normalizedClient;
                loadPOPs(normalizedClient, popFromURL);
            }, 100);
        }
    }
});

// Tema
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-mode');
    }
}

// Event Listeners
function initEventListeners() {
    const clientSelect = document.getElementById('client-select');
    const newPopBtn = document.getElementById('new-pop-btn');
    const popForm = document.getElementById('pop-form');

    clientSelect.addEventListener('change', (e) => {
        currentClient = e.target.value;
        if (currentClient) {
            loadPOPs(currentClient);
        }
    });

    newPopBtn.addEventListener('click', createNewPOP);
    popForm.addEventListener('submit', savePOP);
}

// Carrega lista de clientes
function loadClients() {
    const clientSelect = document.getElementById('client-select');
    clientSelect.innerHTML = '<option value="">Selecione um cliente</option>';
    
    CLIENTS.forEach(client => {
        const option = document.createElement('option');
        option.value = client;
        option.textContent = client.charAt(0).toUpperCase() + client.slice(1);
        clientSelect.appendChild(option);
    });
}

// Carrega POPs via API
async function loadPOPs(client, popToOpen = null) {
    const popList = document.getElementById('pop-list-admin');
    popList.innerHTML = '<div class="loading">Carregando procedimentos...</div>';

    try {
        const pops = await api.getPOPs(client);
        allPOPs[client] = pops;
        
        renderPOPList(pops);
        
        if (popToOpen) {
            openPOPByIdentifier(popToOpen);
        }
        
    } catch (error) {
        console.error('Erro ao carregar POPs:', error);
        popList.innerHTML = '<div class="error">Erro ao carregar procedimentos.</div>';
    }
}

// Abre um POP específico
function openPOPByIdentifier(identifier) {
    if (!currentClient || !allPOPs[currentClient]) return;
    
    const normalizedIdentifier = identifier.toLowerCase().trim();
    
    const pop = allPOPs[currentClient].find(p => {
        const filenameWithoutExt = p.filename ? p.filename.replace('.json', '').toLowerCase() : '';
        const titleNormalized = p.title ? p.title.toLowerCase() : '';
        
        return filenameWithoutExt === normalizedIdentifier || 
               titleNormalized === normalizedIdentifier ||
               filenameWithoutExt.includes(normalizedIdentifier) ||
               titleNormalized.includes(normalizedIdentifier);
    });
    
    if (pop) {
        const popItems = document.querySelectorAll('.pop-list-item');
        popItems.forEach((item, index) => {
            if (allPOPs[currentClient][index] === pop) {
                popItems.forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
        
        loadPOPToForm(pop);
    }
}

// Renderiza lista de POPs
function renderPOPList(pops) {
    const popList = document.getElementById('pop-list-admin');
    
    if (!pops || pops.length === 0) {
        popList.innerHTML = '<div class="loading">Nenhum procedimento encontrado.</div>';
        return;
    }

    popList.innerHTML = '';
    
    pops.forEach((pop, index) => {
        const item = document.createElement('div');
        item.className = 'pop-list-item';
        item.dataset.index = index;
        
        const categoryBadges = {
            network: 'badge-blue',
            infrastructure: 'badge-purple',
            cloud: 'badge-green',
            database: 'badge-orange'
        };
        
        item.innerHTML = `
            <div class="pop-list-item-info">
                <h4>${pop.title || 'Sem título'}</h4>
                <p><span class="badge ${categoryBadges[pop.category] || 'badge-blue'}">${pop.category || 'geral'}</span></p>
            </div>
        `;
        
        item.addEventListener('click', () => {
            document.querySelectorAll('.pop-list-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            loadPOPToForm(pop);
        });
        
        popList.appendChild(item);
    });
}

// Cria novo POP
function createNewPOP() {
    if (!currentClient) {
        Utils.showAlert('Selecione um cliente primeiro!', 'danger');
        return;
    }
    
    isEditMode = false;
    currentPOP = null;
    document.getElementById('delete-btn').style.display = 'none';
    document.getElementById('pop-form').reset();
    clearDynamicLists();
    Utils.showAlert('Preencha os dados para criar um novo POP', 'info');
}

// Carrega POP no formulário
function loadPOPToForm(pop) {
    isEditMode = true;
    currentPOP = pop;
    document.getElementById('delete-btn').style.display = 'inline-flex';
    
    document.getElementById('pop-title').value = pop.title || '';
    document.getElementById('pop-category').value = pop.category || '';
    document.getElementById('pop-icon').value = pop.icon || '';
    
    clearDynamicLists();
    
    if (pop.identification) pop.identification.forEach(item => addIdentification(item));
    if (pop.common_hosts) pop.common_hosts.forEach(host => addHost(host));
    if (pop.causes) pop.causes.forEach(cause => addCause(cause));
    if (pop.procedures) pop.procedures.forEach(procedure => addProcedure(procedure));
    if (pop.anydesk_hosts) pop.anydesk_hosts.forEach(anydesk => addAnyDesk(anydesk));
    
    Utils.showAlert('POP carregado com sucesso!', 'success');
}

// Limpa listas dinâmicas
function clearDynamicLists() {
    document.getElementById('identification-list').innerHTML = '';
    document.getElementById('hosts-list').innerHTML = '';
    document.getElementById('causes-list').innerHTML = '';
    document.getElementById('procedures-list').innerHTML = '';
    document.getElementById('anydesk-list').innerHTML = '';
}

// Adiciona campos (reutilizando código do original)
function addIdentification(value = '') {
    const list = document.getElementById('identification-list');
    const item = document.createElement('div');
    item.className = 'dynamic-item';
    item.innerHTML = `
        <textarea class="form-textarea" placeholder="Descrição da identificação" style="min-height: 60px;">${value}</textarea>
        <button type="button" class="btn btn-danger btn-icon" onclick="this.parentElement.remove()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;
    list.appendChild(item);
}

function addHost(value = '') {
    const list = document.getElementById('hosts-list');
    const item = document.createElement('div');
    item.className = 'dynamic-item';
    item.innerHTML = `
        <input type="text" class="form-input" placeholder="Nome do host ou sigla" value="${value}">
        <button type="button" class="btn btn-danger btn-icon" onclick="this.parentElement.remove()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;
    list.appendChild(item);
}

function addCause(value = '') {
    const list = document.getElementById('causes-list');
    const item = document.createElement('div');
    item.className = 'dynamic-item';
    item.innerHTML = `
        <textarea class="form-textarea" placeholder="Descrição da causa" style="min-height: 60px;">${value}</textarea>
        <button type="button" class="btn btn-danger btn-icon" onclick="this.parentElement.remove()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;
    list.appendChild(item);
}

function addProcedure(procedure = null) {
    const list = document.getElementById('procedures-list');
    const item = document.createElement('div');
    item.className = 'dynamic-item procedure-item-container';
    
    const procedureData = typeof procedure === 'string' ? { title: procedure, details: [] } : procedure || { title: '', details: [] };
    
    item.innerHTML = `
        <div class="procedure-item-header">
            <button type="button" class="btn btn-danger btn-icon" onclick="this.closest('.dynamic-item').remove()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <strong>Procedimento</strong>
        </div>
        <textarea class="form-textarea procedure-title" placeholder="Título do procedimento" style="min-height: 60px; margin-bottom: 0.75rem;">${procedureData.title}</textarea>
        <div class="procedure-details-list"></div>
        <button type="button" class="btn btn-secondary" style="width: 100%; font-size: 0.75rem;" onclick="addProcedureDetail(this.previousElementSibling)">
            + Adicionar Detalhe
        </button>
    `;
    
    list.appendChild(item);
    
    const detailsList = item.querySelector('.procedure-details-list');
    if (procedureData.details && procedureData.details.length > 0) {
        procedureData.details.forEach(detail => {
            addProcedureDetail(detailsList, detail);
        });
    }
}

function addProcedureDetail(detailsList, detail = null) {
    const detailItem = document.createElement('div');
    detailItem.style.cssText = 'margin-bottom: 0.75rem; padding: 0.75rem; background-color: var(--bg-secondary); border-radius: 0.375rem; border: 1px solid var(--border-color);';
    
    const detailType = detail?.type || 'text';
    const detailData = detail || {};
    
    let content = `
        <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 0.5rem;">
            <select class="form-select detail-type-select" style="flex: 1; font-size: 0.75rem;">
                <option value="text" ${detailType === 'text' || typeof detail === 'string' ? 'selected' : ''}>Texto Simples</option>
                <option value="quote" ${detailType === 'quote' ? 'selected' : ''}>Citação</option>
                <option value="link" ${detailType === 'link' ? 'selected' : ''}>Link/URL</option>
                <option value="credentials" ${detailType === 'credentials' ? 'selected' : ''}>Credenciais</option>
                <option value="contact" ${detailType === 'contact' ? 'selected' : ''}>Contato</option>
                <option value="menu" ${detailType === 'menu' ? 'selected' : ''}>Menu</option>
                <option value="zabbix_alert" ${detailType === 'zabbix_alert' ? 'selected' : ''}>Alerta Zabbix</option>
            </select>
            <button type="button" class="btn btn-danger btn-icon" style="margin-left: 0.5rem;" onclick="this.closest('div').parentElement.remove()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        <div class="detail-content">
    `;
    
    content += getDetailContentHTML(detailType, detailData, detail);
    content += `</div>`;
    
    detailItem.innerHTML = content;
    
    const typeSelect = detailItem.querySelector('.detail-type-select');
    typeSelect.addEventListener('change', (e) => {
        updateDetailContent(detailItem, e.target.value);
    });

    if (detailType === 'zabbix_alert') {
        setupSeverityButtons(detailItem);
    }
    
    detailsList.appendChild(detailItem);
}

function getDetailContentHTML(type, data, detail) {
    if (type === 'text' || typeof detail === 'string') {
        const textValue = typeof detail === 'string' ? detail : data.text || '';
        return `<textarea class="form-textarea" placeholder="Texto do detalhe" style="min-height: 60px;">${textValue}</textarea>`;
    } else if (type === 'quote') {
        return `<textarea class="form-textarea" placeholder="Texto da citação" style="min-height: 80px;">${data.text || ''}</textarea>`;
    } else if (type === 'contact') {
        return `
            <input type="text" class="form-input" placeholder="Nome do contato" value="${data.name || ''}" style="margin-bottom: 0.5rem;">
            <input type="text" class="form-input" placeholder="Método (Ex: Whatsapp)" value="${data.method || ''}" style="margin-bottom: 0.5rem;">
            <input type="text" class="form-input" placeholder="Telefone" value="${data.phone || ''}">
        `;
    } else if (type === 'menu') {
        return `
            <textarea class="form-textarea" placeholder='Path (JSON Array): [{"label":"Scripts"},{"option":"Comandos","selected":true}]' style="min-height: 60px; margin-bottom: 0.5rem;">${JSON.stringify(data.path || [])}</textarea>
            <textarea class="form-textarea" placeholder='Submenu (JSON Array): [{"label":"Item 1"},{"label":"Item 2","selected":true}]' style="min-height: 60px;">${JSON.stringify(data.submenu || [])}</textarea>
        `;
    } else if (type === 'zabbix_alert') {
        const severity = data.severity || 'information';
        return `
            <textarea class="form-textarea" placeholder="Texto do alerta Zabbix" style="min-height: 60px; margin-bottom: 0.5rem;">${data.text || ''}</textarea>
            <label class="form-label" style="margin-bottom: 0.25rem;">Severidade:</label>
            <div class="severity-selector">
                <button type="button" class="severity-option severity-not-classified ${severity === 'not_classified' ? 'selected' : ''}" data-severity="not_classified">Not classified</button>
                <button type="button" class="severity-option severity-information ${severity === 'information' ? 'selected' : ''}" data-severity="information">Information</button>
                <button type="button" class="severity-option severity-warning ${severity === 'warning' ? 'selected' : ''}" data-severity="warning">Warning</button>
                <button type="button" class="severity-option severity-average ${severity === 'average' ? 'selected' : ''}" data-severity="average">Average</button>
                <button type="button" class="severity-option severity-high ${severity === 'high' ? 'selected' : ''}" data-severity="high">High</button>
                <button type="button" class="severity-option severity-disaster ${severity === 'disaster' ? 'selected' : ''}" data-severity="disaster">Disaster</button>
            </div>
        `;
    } else if (type === 'link') {
        return `
            <input type="text" class="form-input" placeholder="Título do link" value="${data.title || ''}" style="margin-bottom: 0.5rem;">
            <input type="text" class="form-input" placeholder="URL (Ex: https://exemplo.com)" value="${data.url || ''}">
        `;
    } else if (type === 'credentials') {
        return `
            <input type="text" class="form-input" placeholder="Nome do serviço" value="${data.service || ''}" style="margin-bottom: 0.5rem;">
            <input type="text" class="form-input" placeholder="Usuário" value="${data.username || ''}" style="margin-bottom: 0.5rem;">
            <input type="text" class="form-input" placeholder="Senha" value="${data.password || ''}">
        `;
    }    
    return '';
}

function updateDetailContent(detailItem, type) {
    const contentDiv = detailItem.querySelector('.detail-content');
    contentDiv.innerHTML = getDetailContentHTML(type, {}, null);
    
    if (type === 'zabbix_alert') {
        setupSeverityButtons(detailItem);
    }
}

function setupSeverityButtons(container) {
    const buttons = container.querySelectorAll('.severity-option');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            buttons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });
}

function addAnyDesk(anydesk = null) {
    const list = document.getElementById('anydesk-list');
    const item = document.createElement('div');
    item.className = 'dynamic-item';
    item.innerHTML = `
        <input type="text" class="form-input" placeholder="Nome do host" value="${anydesk?.host || ''}" style="flex: 1;">
        <input type="text" class="form-input" placeholder="Código AnyDesk" value="${anydesk?.code || ''}" style="flex: 1;">
        <button type="button" class="btn btn-danger btn-icon" onclick="this.parentElement.remove()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;
    list.appendChild(item);
}

// Coleta dados do formulário
function collectFormData() {
    const data = {
        title: document.getElementById('pop-title').value,
        client: currentClient.charAt(0).toUpperCase() + currentClient.slice(1),
        category: document.getElementById('pop-category').value,
        icon: document.getElementById('pop-icon').value,
        identification: [],
        common_hosts: [],
        causes: [],
        procedures: [],
        anydesk_hosts: []
    };
    
    document.querySelectorAll('#identification-list textarea').forEach(textarea => {
        if (textarea.value.trim()) data.identification.push(textarea.value.trim());
    });
    
    document.querySelectorAll('#hosts-list input').forEach(input => {
        if (input.value.trim()) data.common_hosts.push(input.value.trim());
    });
    
    document.querySelectorAll('#causes-list textarea').forEach(textarea => {
        if (textarea.value.trim()) data.causes.push(textarea.value.trim());
    });
    
    document.querySelectorAll('#procedures-list > .dynamic-item').forEach(procItem => {
        const title = procItem.querySelector('.procedure-title').value.trim();
        if (!title) return;
        
        const procedure = { title: title, details: [] };
        
        procItem.querySelectorAll('.procedure-details-list > div').forEach(detailItem => {
            const type = detailItem.querySelector('.detail-type-select').value;
            const contentDiv = detailItem.querySelector('.detail-content');
            
            if (type === 'text') {
                const text = contentDiv.querySelector('textarea').value.trim();
                if (text) procedure.details.push(text);
            } else if (type === 'quote') {
                const text = contentDiv.querySelector('textarea').value.trim();
                if (text) procedure.details.push({ type: 'quote', text: text });
            } else if (type === 'contact') {
                const inputs = contentDiv.querySelectorAll('input');
                const name = inputs[0].value.trim();
                const method = inputs[1].value.trim();
                const phone = inputs[2].value.trim();
                if (name && phone) {
                    procedure.details.push({ type: 'contact', name, method, phone });
                }
            } else if (type === 'menu') {
                const textareas = contentDiv.querySelectorAll('textarea');
                try {
                    const path = JSON.parse(textareas[0].value);
                    const submenu = JSON.parse(textareas[1].value);
                    if (path.length > 0) {
                        procedure.details.push({ type: 'menu', path, submenu });
                    }
                } catch (e) {
                    console.error('Erro ao parsear menu JSON:', e);
                }
            } else if (type === 'zabbix_alert') {
                const text = contentDiv.querySelector('textarea').value.trim();
                const selectedSeverity = contentDiv.querySelector('.severity-option.selected');
                const severity = selectedSeverity ? selectedSeverity.dataset.severity : 'information';
                if (text) {
                    procedure.details.push({ type: 'zabbix_alert', text: text, severity: severity });
                }
            } else if (type === 'link') {
                const inputs = contentDiv.querySelectorAll('input');
                const title = inputs[0].value.trim();
                const url = inputs[1].value.trim();
                if (title && url) {
                    procedure.details.push({ type: 'link', title, url });
                }
            } else if (type === 'credentials') {
                const inputs = contentDiv.querySelectorAll('input');
                const service = inputs[0].value.trim();
                const username = inputs[1].value.trim();
                const password = inputs[2].value.trim();
                if (service && (username || password)) {
                    procedure.details.push({ type: 'credentials', service, username, password });
                }
            }
        });
        
        data.procedures.push(procedure);
    });
    
    document.querySelectorAll('#anydesk-list .dynamic-item').forEach(item => {
        const inputs = item.querySelectorAll('input');
        const host = inputs[0].value.trim();
        const code = inputs[1].value.trim();
        if (host && code) {
            data.anydesk_hosts.push({ host, code });
        }
    });
    
    return data;
}

// Salva POP via API
async function savePOP(e) {
    e.preventDefault();
    
    if (!currentClient) {
        Utils.showAlert('Selecione um cliente primeiro!', 'danger');
        return;
    }
    
    const data = collectFormData();
    
    if (!data.title) {
        Utils.showAlert('O título é obrigatório!', 'danger');
        return;
    }
    
    try {
        if (isEditMode && currentPOP) {
            await api.updatePOP(currentClient, currentPOP.filename, data);
            Utils.showAlert(`POP "${data.title}" atualizado!`, 'success');
        } else {
            const result = await api.createPOP(currentClient, data);
            Utils.showAlert(`POP "${data.title}" criado! (${result.filename})`, 'success');
        }
        
        loadPOPs(currentClient);
        
    } catch (error) {
        console.error('Erro ao salvar POP:', error);
        Utils.showAlert(`Erro ao salvar: ${error.message}`, 'danger');
    }
}

// Visualizar JSON
function previewJSON() {
    const data = collectFormData();
    const jsonString = JSON.stringify(data, null, 2);
    
    const preview = window.open('', 'JSON Preview', 'width=800,height=600');
    preview.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Preview JSON - ${data.title}</title>
            <style>
                body { font-family: 'Courier New', monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
                pre { white-space: pre-wrap; word-wrap: break-word; }
            </style>
        </head>
        <body>
            <h2>${data.title}</h2>
            <pre>${jsonString}</pre>
        </body>
        </html>
    `);
}

// Excluir POP via API
async function deletePOP() {
    if (!currentPOP) return;
    
    if (confirm(`Tem certeza que deseja excluir o POP "${currentPOP.title}"?`)) {
        try {
            await api.deletePOP(currentClient, currentPOP.filename);
            Utils.showAlert(`POP "${currentPOP.title}" excluído!`, 'success');
            createNewPOP();
            loadPOPs(currentClient);
        } catch (error) {
            console.error('Erro ao excluir POP:', error);
            Utils.showAlert(`Erro ao excluir: ${error.message}`, 'danger');
        }
    }
}

// Exporta funções
window.addIdentification = addIdentification;
window.addHost = addHost;
window.addCause = addCause;
window.addProcedure = addProcedure;
window.addProcedureDetail = addProcedureDetail;
window.addAnyDesk = addAnyDesk;
window.previewJSON = previewJSON;
window.deletePOP = deletePOP;
