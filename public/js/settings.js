// settings.js - Gerenciamento de Configurações

let configData = {};
let usersData = [];

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    
    // Verificar permissão de admin
    if (!authHandler.user || authHandler.user.type !== 'full') {
        showAlert('Acesso negado. Apenas administradores podem acessar esta página.', 'danger');
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }
    
    await loadConfig();
    await loadUsers();
    
    initEventListeners();
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
    document.getElementById('auth-form').addEventListener('submit', saveAuthConfig);
    document.getElementById('sync-form').addEventListener('submit', saveSyncConfig);
    
    document.getElementById('mode').addEventListener('change', (e) => {
        const syncOptions = document.getElementById('sync-options');
        syncOptions.style.display = e.target.value === 'local' ? 'block' : 'none';
    });
}

// Tabs
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.closest('.tab-btn').classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    // Carregar dados específicos da tab
    if (tab === 'users') {
        loadUsers();
    } else if (tab === 'bypass') {
        checkBypassStatus();
    } else if (tab === 'sync') {
        loadSyncHistory();
    }
}

// ===== CONFIG =====
async function loadConfig() {
    try {
        const response = await authHandler.fetch('/api/config');
        const configs = await response.json();
        
        configData = {};
        configs.forEach(c => configData[c.key] = c.value);
        
        // Preencher formulários
        populateAuthForm();
        populateSyncForm();
        
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        showAlert('Erro ao carregar configurações', 'danger');
    }
}

function populateAuthForm() {
    document.getElementById('auth-enabled').checked = configData.auth_enabled === 'true';
    document.getElementById('microsoft-tenant').value = configData.microsoft_tenant_id || '';
    document.getElementById('microsoft-client').value = configData.microsoft_client_id || '';
    document.getElementById('microsoft-secret').value = configData.microsoft_client_secret || '';
    document.getElementById('block-new-users').checked = configData.block_new_users === 'true';
}

function populateSyncForm() {
    document.getElementById('mode').value = configData.mode || 'cloud';
    document.getElementById('cloud-url').value = configData.cloud_server_url || '';
    document.getElementById('sync-enabled').checked = configData.sync_enabled === 'true';
    document.getElementById('sync-time').value = configData.sync_time || '03:00';
    
    const syncOptions = document.getElementById('sync-options');
    syncOptions.style.display = configData.mode === 'local' ? 'block' : 'none';
}

async function saveAuthConfig(e) {
    e.preventDefault();
    
    const updates = {
        auth_enabled: document.getElementById('auth-enabled').checked ? 'true' : 'false',
        microsoft_tenant_id: document.getElementById('microsoft-tenant').value.trim(),
        microsoft_client_id: document.getElementById('microsoft-client').value.trim(),
        microsoft_client_secret: document.getElementById('microsoft-secret').value.trim(),
        block_new_users: document.getElementById('block-new-users').checked ? 'true' : 'false'
    };
    
    try {
        for (const [key, value] of Object.entries(updates)) {
            await authHandler.fetch(`/api/config/${key}`, {
                method: 'PUT',
                body: JSON.stringify({ value })
            });
        }
        
        showAlert('Configurações de autenticação salvas!', 'success');
        
        // Se desabilitou auth, avisar
        if (updates.auth_enabled === 'false') {
            showAlert('Atenção: Autenticação desabilitada! Sistema acessível sem login.', 'info');
        }
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showAlert('Erro ao salvar configurações', 'danger');
    }
}

async function saveSyncConfig(e) {
    e.preventDefault();
    
    const updates = {
        mode: document.getElementById('mode').value,
        cloud_server_url: document.getElementById('cloud-url').value.trim(),
        sync_enabled: document.getElementById('sync-enabled').checked ? 'true' : 'false',
        sync_time: document.getElementById('sync-time').value
    };
    
    try {
        for (const [key, value] of Object.entries(updates)) {
            await authHandler.fetch(`/api/config/${key}`, {
                method: 'PUT',
                body: JSON.stringify({ value })
            });
        }
        
        showAlert('Configurações de sincronização salvas!', 'success');
        
        // Reiniciar servidor para aplicar mudanças (sugerir)
        if (updates.mode !== configData.mode) {
            showAlert('Reinicie o servidor para aplicar alterações de modo', 'info');
        }
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showAlert('Erro ao salvar configurações', 'danger');
    }
}

// ===== USERS =====
async function loadUsers() {
    try {
        const response = await authHandler.fetch('/api/users');
        usersData = await response.json();
        renderUsersTable();
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        document.getElementById('users-table').innerHTML = '<div class="error">Erro ao carregar usuários</div>';
    }
}

function renderUsersTable() {
    const container = document.getElementById('users-table');
    
    if (usersData.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum usuário cadastrado</div>';
        return;
    }
    
    let html = `
        <table class="config-table">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Último Login</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    usersData.forEach(user => {
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('pt-BR') : 'Nunca';
        const statusBadge = user.active ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-orange">Inativo</span>';
        const typeBadge = user.user_type === 'full' ? '<span class="badge badge-blue">Total</span>' : '<span class="badge badge-purple">Padrão</span>';
        
        html += `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${typeBadge}</td>
                <td>${statusBadge}</td>
                <td style="font-size: 0.75rem; color: var(--text-secondary);">${lastLogin}</td>
                <td>
                    <button onclick="editUser(${user.id})" class="btn btn-secondary btn-sm">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

async function editUser(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) return;
    
    const newType = user.user_type === 'full' ? 'standard' : 'full';
    const newActive = !user.active;
    
    const action = confirm(
        `Alterações para ${user.name}:\n\n` +
        `Tipo: ${user.user_type === 'full' ? 'Total → Padrão' : 'Padrão → Total'}\n` +
        `Status: ${user.active ? 'Ativo → Inativo' : 'Inativo → Ativo'}\n\n` +
        `Confirmar?`
    );
    
    if (!action) return;
    
    try {
        await authHandler.fetch(`/api/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ user_type: newType, active: newActive })
        });
        
        showAlert('Usuário atualizado!', 'success');
        loadUsers();
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        showAlert('Erro ao atualizar usuário', 'danger');
    }
}

// ===== BYPASS =====
async function checkBypassStatus() {
    try {
        const response = await authHandler.fetch('/api/config');
        const configs = await response.json();
        const bypassConfig = configs.find(c => c.key === 'bypass_code');
        
        const statusDiv = document.getElementById('bypass-status');
        
        if (bypassConfig && bypassConfig.value) {
            statusDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 1.25rem; height: 1.25rem; color: var(--accent-green);">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span style="color: var(--accent-green); font-weight: 600;">Código configurado</span>
                </div>
            `;
        } else {
            statusDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 1.25rem; height: 1.25rem; color: var(--accent-red);">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    <span style="color: var(--accent-red); font-weight: 600;">Nenhum código configurado</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erro ao verificar bypass:', error);
    }
}

async function generateBypassCode() {
    if (!confirm('Gerar novo código de bypass? O código anterior será invalidado.')) {
        return;
    }
    
    try {
        const response = await authHandler.fetch('/api/config/generate-bypass', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.code) {
            document.getElementById('bypass-code-value').value = data.code;
            document.getElementById('bypass-code-display').style.display = 'block';
            showAlert('Código gerado! Anote em local seguro.', 'success');
            checkBypassStatus();
        }
    } catch (error) {
        console.error('Erro ao gerar código:', error);
        showAlert('Erro ao gerar código', 'danger');
    }
}

function copyBypassCode() {
    const input = document.getElementById('bypass-code-value');
    input.select();
    document.execCommand('copy');
    showAlert('Código copiado!', 'success');
}

// ===== SYNC =====
async function runManualSync() {
    document.getElementById('sync-status').style.display = 'block';
    
    try {
        const response = await authHandler.fetch('/api/sync/manual', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`Sincronização concluída! ${result.recordsSynced} registros sincronizados.`, 'success');
            loadSyncHistory();
        } else {
            showAlert(`Erro na sincronização: ${result.error}`, 'danger');
        }
    } catch (error) {
        console.error('Erro ao sincronizar:', error);
        showAlert('Erro ao sincronizar', 'danger');
    } finally {
        document.getElementById('sync-status').style.display = 'none';
    }
}

async function loadSyncHistory() {
    try {
        const response = await authHandler.fetch('/api/sync/history');
        const history = await response.json();
        
        const logDiv = document.getElementById('sync-log');
        
        if (history.length === 0) {
            logDiv.innerHTML = '<div class="loading">Nenhuma sincronização realizada</div>';
            return;
        }
        
        let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
        
        history.forEach(log => {
            const date = new Date(log.started_at).toLocaleString('pt-BR');
            const status = log.status === 'completed' ? 'success' : log.status === 'failed' ? 'danger' : 'info';
            const icon = log.status === 'completed' ? '✓' : log.status === 'failed' ? '✗' : '⟳';
            
            html += `
                <div class="info-box" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="color: var(--accent-${status === 'success' ? 'green' : status === 'danger' ? 'red' : 'blue'});">${icon}</span>
                        <strong>${date}</strong>
                        ${log.records_synced ? ` - ${log.records_synced} registros` : ''}
                    </div>
                    <span class="badge badge-${status === 'success' ? 'green' : status === 'danger' ? 'orange' : 'blue'}">${log.status}</span>
                </div>
            `;
        });
        
        html += '</div>';
        logDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

// Alertas
function showAlert(message, type) {
    const container = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.className = `alert-box alert-${type}`;
    alert.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 1.25rem; height: 1.25rem;">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${message}</span>
    `;
    container.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

// Exportar funções globais
window.switchTab = switchTab;
window.editUser = editUser;
window.generateBypassCode = generateBypassCode;
window.copyBypassCode = copyBypassCode;
window.runManualSync = runManualSync;