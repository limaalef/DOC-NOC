/**
 * Gerenciador de Autenticação no Frontend
 * Intercepta requisições e adiciona token JWT
 */

class AuthHandler {
  constructor() {
    this.token = localStorage.getItem('auth_token');
    this.user = this.getUser();
    this.authEnabled = null;
  }

  /**
   * Obter usuário do localStorage
   */
  getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Salvar token e usuário
   */
  login(token, user) {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    this.token = token;
    this.user = user;
  }

  /**
   * Remover token e usuário
   */
  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    this.token = null;
    this.user = null;
    window.location.href = '/login.html';
  }

  /**
   * Verificar se está autenticado
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Verificar se usuário tem permissão
   */
  hasPermission(resource, level = 1) {
    if (!this.user) return false;
    
    // Usuário Full tem acesso total
    if (this.user.type === 'full' || this.user.bypass) return true;
    
    // Verificar permissão específica (implementar quando necessário)
    return false;
  }

  /**
   * Obter headers com token
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Fazer requisição autenticada
   */
  async fetch(url, options = {}) {
    // Verificar se autenticação está habilitada
    if (this.authEnabled === null) {
      await this.checkAuthEnabled();
    }

    // Se auth desabilitada, fazer requisição normal
    if (!this.authEnabled) {
      return fetch(url, options);
    }

    // Adicionar headers de autenticação
    const headers = {
      ...this.getHeaders(),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, { ...options, headers });

      // Se 401 (não autorizado), redirecionar para login
      if (response.status === 401) {
        this.logout();
        return response;
      }

      // Se 403 (sem permissão), mostrar erro
      if (response.status === 403) {
        const data = await response.json();
        alert(`Sem permissão: ${data.error}`);
        return response;
      }

      return response;
    } catch (error) {
      console.error('Erro na requisição:', error);
      throw error;
    }
  }

  /**
   * Verificar se autenticação está habilitada
   */
  async checkAuthEnabled() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      
      // Se conseguiu acessar sem token, auth está desabilitada
      this.authEnabled = false;
      
      // Verificar configuração específica
      try {
        const configResponse = await fetch('/api/config/public');
        const config = await configResponse.json();
        this.authEnabled = config.auth_enabled === 'true';
      } catch (e) {
        // Ignorar erro
      }
    } catch (error) {
      console.error('Erro ao verificar auth:', error);
      this.authEnabled = false;
    }
  }

  /**
   * Verificar se precisa redirecionar para login
   */
  async requireAuth() {
    await this.checkAuthEnabled();

    if (!this.authEnabled) {
      return; // Auth desabilitada
    }

    if (!this.isAuthenticated()) {
      window.location.href = '/login.html';
      return;
    }

    // Verificar se token é válido
    try {
      const response = await fetch('/api/auth/verify', {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        this.logout();
      }
    } catch (error) {
      console.error('Erro ao verificar token:', error);
    }
  }

  /**
   * Adicionar botão de logout ao header
   */
  addLogoutButton() {
    if (!this.isAuthenticated() || !this.authEnabled) return;

    const header = document.querySelector('.header-content');
    if (!header) return;

    // Verificar se já existe
    if (document.getElementById('user-menu')) return;

    const userMenu = document.createElement('div');
    userMenu.id = 'user-menu';
    userMenu.style.cssText = 'display: flex; align-items: center; gap: 1rem; margin-left: auto;';

    userMenu.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; color: white;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 1.25rem; height: 1.25rem;">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span>${this.user?.name || 'Usuário'}</span>
        ${this.user?.type === 'full' ? '<span style="background: #10b981; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600;">ADMIN</span>' : ''}
      </div>
      <button id="logout-btn" class="btn btn-secondary" style="padding: 0.5rem 1rem;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sair
      </button>
    `;

    // Inserir antes do theme-toggle se existir
    const themeToggle = header.querySelector('#theme-toggle');
    if (themeToggle) {
      header.insertBefore(userMenu, themeToggle);
    } else {
      header.appendChild(userMenu);
    }

    // Adicionar evento de logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      if (confirm('Deseja realmente sair?')) {
        this.logout();
      }
    });
  }

  /**
   * Adicionar link para configurações (apenas admin)
   */
  addSettingsLink() {
    if (!this.user || this.user.type !== 'full') return;

    const header = document.querySelector('.header-content > div:last-child');
    if (!header) return;

    // Verificar se já existe
    if (document.querySelector('[href="settings.html"]')) return;

    const settingsLink = document.createElement('a');
    settingsLink.href = 'settings.html';
    settingsLink.className = 'btn btn-secondary';
    settingsLink.style.marginRight = '0.5rem';
    settingsLink.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6m0-6h6m-6 0H6"/>
      </svg>
      Configurações
    `;

    header.insertBefore(settingsLink, header.firstChild);
  }
}

// Instância global
const authHandler = new AuthHandler();

// Adicionar botões ao carregar página
document.addEventListener('DOMContentLoaded', async () => {
  await authHandler.checkAuthEnabled();
  
  // Não redirecionar para login nas páginas públicas
  const publicPages = ['login.html', 'auth'];
  const currentPage = window.location.pathname;
  const isPublicPage = publicPages.some(page => currentPage.includes(page));

  if (!isPublicPage && authHandler.authEnabled) {
    await authHandler.requireAuth();
    authHandler.addLogoutButton();
    authHandler.addSettingsLink();
  }
});

// Substituir fetch global (opcional)
window.authFetch = (url, options) => authHandler.fetch(url, options);

// Exportar para uso global
window.authHandler = authHandler;
