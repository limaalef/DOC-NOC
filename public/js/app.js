// Configuração de clientes
const CLIENTS = ['caldic', 'ituniverse', 'softys'];

// Estado da aplicação
let currentClient = '';
let allPOPs = {};
let selectedPOP = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventListeners();
    loadClients();
    
    // Verificar parâmetros da URL
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
    const searchInput = document.getElementById('search-input');

    clientSelect.addEventListener('change', (e) => {
        currentClient = e.target.value;
        if (currentClient) {
            loadPOPs(currentClient);
        }
    });

    searchInput.addEventListener('input', (e) => {
        filterPOPs(e.target.value);
    });
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

// Carrega POPs de um cliente via API
async function loadPOPs(client, popToOpen = null) {
    const popList = document.getElementById('pop-list');
    popList.innerHTML = '<div class="loading">Carregando procedimentos...</div>';

    try {
        const pops = await api.getPOPs(client);
        allPOPs[client] = pops;

        if (pops.length === 0) {
            popList.innerHTML = '<div class="error">Nenhum procedimento encontrado para este cliente.</div>';
            return;
        }

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
        const popItems = document.querySelectorAll('.pop-item');
        popItems.forEach((item, index) => {
            if (allPOPs[currentClient][index] === pop) {
                popItems.forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
        
        selectedPOP = pop;
        renderPOPContent(pop);
    }
}

// Renderiza lista de POPs
function renderPOPList(pops) {
    const popList = document.getElementById('pop-list');
    
    if (!pops || pops.length === 0) {
        popList.innerHTML = '<div class="loading">Nenhum procedimento encontrado.</div>';
        return;
    }

    popList.innerHTML = '';
    
    pops.forEach((pop, index) => {
        const item = document.createElement('div');
        item.className = 'pop-item';
        item.dataset.index = index;
        
        item.innerHTML = `
            <div class="pop-icon ${pop.category || 'network'}">
                ${Utils.icons[pop.icon || 'alert']}
            </div>
            <div class="pop-info">
                <h3>${pop.title || 'Sem título'}</h3>
                <p>${(pop.causes || []).length} causas possíveis</p>
            </div>
        `;
        
        item.addEventListener('click', () => {
            document.querySelectorAll('.pop-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            selectedPOP = pop;
            renderPOPContent(pop);
        });
        
        popList.appendChild(item);
    });
}

// Filtra POPs
function filterPOPs(searchTerm) {
    if (!currentClient || !allPOPs[currentClient]) return;
    
    const term = searchTerm.toLowerCase();
    const filtered = allPOPs[currentClient].filter(pop => {
        const titleMatch = (pop.title || '').toLowerCase().includes(term);
        const causesMatch = (pop.causes || []).some(cause => 
            cause.toLowerCase().includes(term)
        );
        const hostsMatch = (pop.common_hosts || []).some(host => 
            host.toLowerCase().includes(term)
        );
        return titleMatch || causesMatch || hostsMatch;
    });
    
    renderPOPList(filtered);
}

// Renderiza conteúdo do POP
function renderPOPContent(pop) {
    const content = document.getElementById('pop-content');
    
    const color = Utils.categoryColors[pop.category] || 'var(--accent-blue)';
    const categoryName = Utils.categoryNames[pop.category] || 'Geral';
    
    let html = `
        <div class="pop-header">
            <div class="pop-header-icon" style="background-color: ${color}">
                ${Utils.icons[pop.icon || 'alert']}
            </div>
            <div class="pop-header-content">
                <h2>${pop.title}</h2>
                <span class="category-badge" style="background-color: ${color}; color: white;">
                    ${categoryName}
                </span>
            </div>
        </div>
    `;
    
    // Identificação
    if (pop.identification && pop.identification.length > 0) {
        html += `
            <div class="section">
                <h3 class="section-title identification">Identificação</h3>
                <div class="info-list">
        `;
        pop.identification.forEach(item => {
            html += `<div class="info-box">${item}</div>`;
        });
        html += `</div></div>`;
    }
    
    // Hosts Comuns
    if (pop.common_hosts && pop.common_hosts.length > 0) {
        html += `
            <div class="section">
                <h3 class="section-title hosts">Hosts Comuns / Siglas</h3>
                <div class="host-tags">
        `;
        pop.common_hosts.forEach(host => {
            html += `<span class="host-tag">${host}</span>`;
        });
        html += `</div></div>`;
    }
    
    // Causas Possíveis
    if (pop.causes && pop.causes.length > 0) {
        html += `
            <div class="section">
                <h3 class="section-title causes">Possíveis Causas</h3>
                <div class="info-list">
        `;
        pop.causes.forEach(cause => {
            html += `
                <div class="info-item alert">
                    ${Utils.icons.alert}
                    <span>${cause}</span>
                </div>
            `;
        });
        html += `</div></div>`;
    }
    
    // Procedimentos
    if (pop.procedures && pop.procedures.length > 0) {
        html += `
            <div class="section">
                <h3 class="section-title procedures">Procedimentos</h3>
                <div class="procedure-list">
        `;
        pop.procedures.forEach((procedure, index) => {
            html += `
                <div class="procedure-item">
                    <div class="procedure-number">${index + 1}</div>
                    <div class="procedure-text">
                        ${procedure.title}
            `;

            // Renderizar detalhes
            if (procedure.details && procedure.details.length > 0) {
                procedure.details.forEach(detail => {
                    html += renderProcedureDetail(detail);
                });
            }

            html += `</div></div>`;
        });
        html += `</div></div>`;
    }

    // Hosts AnyDesk
    if (pop.anydesk_hosts && pop.anydesk_hosts.length > 0) {
        html += `
            <div class="section">
                <h3 class="section-title hosts">Acessos AnyDesk</h3>
                <div class="anydesk-grid">
        `;
        pop.anydesk_hosts.forEach(item => {
            html += `
                <div class="anydesk-card">
                    <h4>${item.host}</h4>
                    <p>${item.code}</p>
                </div>
            `;
        });
        html += `</div></div>`;
    }
    
    content.innerHTML = html;
}

// Renderiza detalhe de procedimento
function renderProcedureDetail(detail) {
    if (typeof detail === 'string') {
        return `<div class="procedure-detail"><span>${detail}</span></div>`;
    }
    
    switch (detail.type) {
        case 'quote':
            return `<div class="detail-quote">${detail.text.replace(/\n/g, '<br>')}</div>`;
        
        case 'contact':
            return `
                <div class="detail-contact">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    <div class="contact-info">
                        <span class="contact-name">${detail.name}</span>
                        <span class="contact-method">${detail.method}:</span>
                        <span class="contact-phone">${detail.phone}</span>
                    </div>
                </div>
            `;
        
        case 'menu':
            return renderMenuDetail(detail);
        
        case 'zabbix_alert':
            const severity = detail.severity || 'information';
            return `
                <div class="detail-zabbix-alert">
                    <div class="zabbix-alert-cell severity-${severity}">
                        <span class="zabbix-alert-link">${detail.text}</span>
                    </div>
                </div>
            `;

        case 'link':
            return `
                <div class="detail-link">
                    <div class="link-title">${detail.title}</div>
                    <div class="link-url">
                        <a href="${detail.url}" target="_blank" rel="noopener noreferrer">${detail.url}</a>
                    </div>
                </div>
            `;

        case 'credentials':
            return `
                <div class="detail-credentials">
                    <div class="credentials-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <span class="credentials-service">${detail.service}</span>
                    </div>
                    <div class="credentials-body">
                        <div class="credential-item">
                            <span class="credential-label">Usuário:</span>
                            <span class="credential-value">${detail.username || 'N/A'}</span>
                            ${detail.username ? `
                                <button class="copy-button" onclick="copyToClipboard('${detail.username.replace(/'/g, "\\'")}', this)" title="Copiar usuário">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                        <div class="credential-item">
                            <span class="credential-label">Senha:</span>
                            <span class="credential-value credential-password" data-password="${detail.password || 'N/A'}">
                                <span class="password-hidden">••••••••</span>
                                <button class="password-toggle" onclick="togglePassword(this)" title="Mostrar/ocultar senha">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                </button>
                            </span>
                            ${detail.password ? `
                                <button class="copy-button" onclick="copyToClipboard('${detail.password.replace(/'/g, "\\'")}', this)" title="Copiar senha">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        
        default:
            return '';
    }
}

// Renderiza menu
function renderMenuDetail(detail) {
    let html = '<div class="detail-menu">';
    
    if (detail.path && detail.path.length > 0) {
        html += '<div class="menu-path">';
        detail.path.forEach((item, idx) => {
            if (idx > 0) html += '<span class="menu-arrow">›</span>';
            html += '<div class="menu-item">';
            if (item.option) {
                html += `<span class="menu-option ${item.selected ? 'selected' : ''}">${item.option}</span>`;
            } else if (item.label) {
                html += `<span class="menu-label">${item.label}</span>`;
            }
            html += '</div>';
        });
        html += '</div>';
    }
    
    if (detail.submenu && detail.submenu.length > 0) {
        html += '<div class="menu-submenu">';
        detail.submenu.forEach(item => {
            html += `<div class="submenu-item ${item.selected ? 'selected' : ''}">${item.label}</div>`;
        });
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

window.togglePassword = function(button) {
    const credentialValue = button.closest('.credential-password');
    const hiddenSpan = credentialValue.querySelector('.password-hidden');
    const password = credentialValue.dataset.password;
    
    if (hiddenSpan.textContent === '••••••••') {
        hiddenSpan.textContent = password;
        hiddenSpan.style.filter = 'none';
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
        `;
    } else {
        hiddenSpan.textContent = '••••••••';
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;
    }
};

window.copyToClipboard = async function(text, button) {
    try {
        await navigator.clipboard.writeText(text);
        
        // Feedback visual
        const originalHTML = button.innerHTML;
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `;
        button.classList.add('copied');
        
        // Restaurar após 2 segundos
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('copied');
        }, 2000);
        
    } catch (err) {
        console.error('Erro ao copiar:', err);
        
        // Fallback para navegadores antigos
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            
            // Feedback visual
            const originalHTML = button.innerHTML;
            button.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;
            button.classList.add('copied');
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('copied');
            }, 2000);
            
        } catch (err2) {
            console.error('Fallback falhou:', err2);
            alert('Não foi possível copiar. Por favor, copie manualmente.');
        }
        
        document.body.removeChild(textArea);
    }
};