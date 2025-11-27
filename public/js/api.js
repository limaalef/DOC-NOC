// Cliente API centralizado para todas as operações
class APIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL || window.location.origin;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // ==================== POPs ====================
    
    async getPOPs(client) {
        return this.request(`/api/pops/${client}`);
    }

    async getPOP(client, filename) {
        return this.request(`/api/pops/${client}/${filename}`);
    }

    async createPOP(client, popData) {
        return this.request(`/api/pops/${client}`, {
            method: 'POST',
            body: JSON.stringify(popData)
        });
    }

    async updatePOP(client, filename, popData) {
        return this.request(`/api/pops/${client}/${filename}`, {
            method: 'PUT',
            body: JSON.stringify(popData)
        });
    }

    async deletePOP(client, filename) {
        return this.request(`/api/pops/${client}/${filename}`, {
            method: 'DELETE'
        });
    }

    // ==================== Escalas ====================
    
    async getAnalysts() {
        return this.request('/api/escalas/analysts');
    }

    async saveAnalysts(analysts) {
        return this.request('/api/escalas/analysts', {
            method: 'POST',
            body: JSON.stringify(analysts)
        });
    }

    async getShifts() {
        return this.request('/api/escalas/shifts');
    }

    async saveShifts(shifts) {
        return this.request('/api/escalas/shifts', {
            method: 'POST',
            body: JSON.stringify(shifts)
        });
    }

    async getSchedules() {
        return this.request('/api/escalas/schedules');
    }

    async saveSchedules(schedules) {
        return this.request('/api/escalas/schedules', {
            method: 'POST',
            body: JSON.stringify(schedules)
        });
    }
}

// Instância global
const api = new APIClient();

// Funções auxiliares compartilhadas
const Utils = {
    // Formatar data
    formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    },

    formatDateISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    formatFullDate(date) {
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
    },

    // Tema
    initTheme(toggleButtonId = 'theme-toggle') {
        const themeToggle = document.getElementById(toggleButtonId);
        if (!themeToggle) return;

        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        });

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
        }
    },

    // Alertas
    showAlert(message, type = 'info', containerId = 'alert-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} não encontrado para exibir alerta`);
            return;
        }

        const alert = document.createElement('div');
        alert.className = `alert-box alert-${type}`;
        alert.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 1.25rem; height: 1.25rem; flex-shrink: 0;">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>${message}</span>
        `;
        container.appendChild(alert);
        
        setTimeout(() => alert.remove(), 5000);
    },

    // Obter parâmetro da URL
    getURLParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },

    // Ícones SVG
    icons: {
        wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/></svg>',
        server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
        database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
        cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
        alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    },

    // Categorias
    categoryColors: {
        network: 'var(--accent-blue)',
        infrastructure: 'var(--accent-purple)',
        cloud: 'var(--accent-green)',
        database: 'var(--accent-orange)'
    },

    categoryNames: {
        network: 'Rede',
        infrastructure: 'Infraestrutura',
        cloud: 'Cloud',
        database: 'Banco de Dados'
    }
};

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.api = api;
    window.Utils = Utils;
}
