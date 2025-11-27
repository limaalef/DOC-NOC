const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const axios = require('axios');
const session = require('express-session');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'noc.db');
const MODE = process.env.MODE || 'cloud'; // 'cloud' ou 'local'

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'noc-dashboard-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static('public'));

// Banco de dados
let db;

async function initDatabase() {
  const dbDir = path.dirname(DB_PATH);
  try {
    await fs.access(dbDir);
  } catch {
    await fs.mkdir(dbDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('✓ Conectado ao banco de dados SQLite');
      app.locals.db = db;
      createTables().then(resolve).catch(reject);
    });
  });
}

async function createTables() {
  const tables = [
    // Tabelas existentes (POPs, Analysts, Shifts, Schedules)
    `CREATE TABLE IF NOT EXISTS pops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client TEXT NOT NULL,
      filename TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT,
      icon TEXT,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      updated_by INTEGER,
      UNIQUE(client, filename),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS analysts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      shift_id INTEGER NOT NULL,
      analyst_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
      FOREIGN KEY (analyst_id) REFERENCES analysts(id) ON DELETE CASCADE,
      UNIQUE(date, shift_id)
    )`,
    
    // NOVAS TABELAS - Sistema de autenticação
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      microsoft_id TEXT UNIQUE,
      user_type TEXT NOT NULL DEFAULT 'standard',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`,
    
    `CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      resource TEXT NOT NULL,
      permission_level INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, resource)
    )`,
    
    // NOVA TABELA - Configurações do sistema
    `CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // NOVA TABELA - Log de sincronização (modo local)
    `CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      records_synced INTEGER DEFAULT 0,
      error_message TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )`,
    
    // Índices
    `CREATE INDEX IF NOT EXISTS idx_pops_client ON pops(client)`,
    `CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date)`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_users_microsoft ON users(microsoft_id)`,
    `CREATE INDEX IF NOT EXISTS idx_config_key ON config(key)`
  ];

  for (const sql of tables) {
    await dbRun(sql);
  }
  
  // Inserir configurações padrão
  await initDefaultConfig();
  
  console.log('✓ Tabelas criadas/verificadas');
}

async function initDefaultConfig() {
  const defaults = [
    { key: 'mode', value: MODE, description: 'Modo de operação: cloud ou local' },
    { key: 'cloud_server_url', value: '', description: 'URL do servidor cloud' },
    { key: 'sync_enabled', value: 'true', description: 'Habilitar sincronização automática' },
    { key: 'sync_time', value: '03:00', description: 'Horário da sincronização diária' },
    { key: 'auth_enabled', value: 'false', description: 'Habilitar autenticação' },
    { key: 'microsoft_tenant_id', value: '', description: 'Microsoft 365 Tenant ID' },
    { key: 'microsoft_client_id', value: '', description: 'Microsoft 365 Client ID' },
    { key: 'microsoft_client_secret', value: '', description: 'Microsoft 365 Client Secret' },
    { key: 'block_new_users', value: 'false', description: 'Bloquear cadastro de novos usuários' },
    { key: 'bypass_code', value: '', description: 'Código de bypass de emergência (hash SHA256)' }
  ];
  
  for (const config of defaults) {
    try {
      await dbRun(
        'INSERT OR IGNORE INTO config (key, value, description) VALUES (?, ?, ?)',
        [config.key, config.value, config.description]
      );
    } catch (error) {
      // Ignorar se já existe
    }
  }
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ==================== AUTH API ====================

// Login com Microsoft 365
app.post('/api/auth/microsoft/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    // Trocar code por token
    const config = await dbAll('SELECT key, value FROM config WHERE key LIKE "microsoft_%"');
    const configMap = {};
    config.forEach(c => configMap[c.key] = c.value);
    
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${configMap.microsoft_tenant_id}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: configMap.microsoft_client_id,
        client_secret: configMap.microsoft_client_secret,
        code: code,
        redirect_uri: `${req.protocol}://${req.get('host')}/auth/callback`,
        grant_type: 'authorization_code'
      })
    );
    
    // Obter perfil do usuário
    const profileResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
    });
    
    const profile = {
      id: profileResponse.data.id,
      email: profileResponse.data.mail || profileResponse.data.userPrincipalName,
      name: profileResponse.data.displayName
    };
    
    // Criar ou atualizar usuário
    const user = await auth.createOrUpdateUser(db, profile);
    
    // Gerar JWT
    const token = auth.generateToken(user);
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, type: user.user_type } });
  } catch (error) {
    console.error('Erro no login Microsoft:', error);
    res.status(400).json({ error: error.message || 'Erro ao autenticar' });
  }
});

// Login com código de bypass
app.post('/api/auth/bypass', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Código não fornecido' });
    }
    
    const valid = await auth.verifyBypassCode(db, code);
    
    if (!valid) {
      return res.status(401).json({ error: 'Código de bypass inválido' });
    }
    
    // Bypass válido - criar token especial
    const bypassUser = {
      id: 0,
      email: 'bypass@system',
      name: 'Bypass Admin',
      user_type: auth.USER_TYPES.FULL
    };
    
    const token = auth.generateToken(bypassUser);
    
    res.json({ token, user: bypassUser, bypass: true });
  } catch (error) {
    console.error('Erro no bypass:', error);
    res.status(500).json({ error: 'Erro ao verificar código' });
  }
});

// Verificar token
app.get('/api/auth/verify', auth.requireAuth(db), (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// ==================== CONFIG API ====================

// Obter todas configurações
app.get('/api/config', auth.requireAuth(db), auth.requirePermission(auth.RESOURCES.SETTINGS, auth.PERMISSION_LEVELS.READ), async (req, res) => {
  try {
    const configs = await dbAll('SELECT key, value, description FROM config');
    
    // Ocultar valores sensíveis para usuários não-admin
    const sanitized = configs.map(c => {
      if (req.user.type !== auth.USER_TYPES.FULL && (c.key.includes('secret') || c.key.includes('bypass'))) {
        return { ...c, value: '***' };
      }
      return c;
    });
    
    res.json(sanitized);
  } catch (error) {
    console.error('Erro ao obter configurações:', error);
    res.status(500).json({ error: 'Erro ao obter configurações' });
  }
});

// Atualizar configuração
app.put('/api/config/:key', auth.requireAuth(db), auth.requirePermission(auth.RESOURCES.SETTINGS, auth.PERMISSION_LEVELS.WRITE), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    await dbRun(
      'UPDATE config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
      [value, key]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    res.status(500).json({ error: 'Erro ao atualizar configuração' });
  }
});

// Gerar novo código de bypass
app.post('/api/config/generate-bypass', auth.requireAuth(db), auth.requirePermission(auth.RESOURCES.SETTINGS, auth.PERMISSION_LEVELS.WRITE), async (req, res) => {
  try {
    if (req.user.type !== auth.USER_TYPES.FULL) {
      return res.status(403).json({ error: 'Apenas administradores podem gerar código de bypass' });
    }
    
    const code = auth.generateBypassCode();
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    
    await dbRun('UPDATE config SET value = ? WHERE key = ?', [hash, 'bypass_code']);
    
    res.json({ code }); // Retornar código apenas uma vez
  } catch (error) {
    console.error('Erro ao gerar bypass:', error);
    res.status(500).json({ error: 'Erro ao gerar código' });
  }
});

// ==================== USERS API ====================

// Listar usuários
app.get('/api/users', auth.requireAuth(db), auth.requirePermission(auth.RESOURCES.USERS, auth.PERMISSION_LEVELS.READ), async (req, res) => {
  try {
    const users = await dbAll('SELECT id, email, name, user_type, active, created_at, last_login FROM users ORDER BY name');
    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// Atualizar usuário
app.put('/api/users/:id', auth.requireAuth(db), auth.requirePermission(auth.RESOURCES.USERS, auth.PERMISSION_LEVELS.WRITE), async (req, res) => {
  try {
    const { id } = req.params;
    const { user_type, active } = req.body;
    
    await dbRun(
      'UPDATE users SET user_type = ?, active = ? WHERE id = ?',
      [user_type, active ? 1 : 0, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Obter permissões do usuário
app.get('/api/users/:id/permissions', auth.requireAuth(db), auth.requirePermission(auth.RESOURCES.USERS, auth.PERMISSION_LEVELS.READ), async (req, res) => {
  try {
    const { id } = req.params;
    const permissions = await dbAll('SELECT resource, permission_level FROM user_permissions WHERE user_id = ?', [id]);
    res.json(permissions);
  } catch (error) {
    console.error('Erro ao obter permissões:', error);
    res.status(500).json({ error: 'Erro ao obter permissões' });
  }
});

// Atualizar permissões do usuário
app.put('/api/users/:id/permissions', auth.requireAuth(db), auth.requirePermission(auth.RESOURCES.USERS, auth.PERMISSION_LEVELS.WRITE), async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body; // Array de { resource, permission_level }
    
    await dbRun('BEGIN TRANSACTION');
    
    for (const perm of permissions) {
      await dbRun(
        'INSERT OR REPLACE INTO user_permissions (user_id, resource, permission_level) VALUES (?, ?, ?)',
        [id, perm.resource, perm.permission_level]
      );
    }
    
    await dbRun('COMMIT');
    
    res.json({ success: true });
  } catch (error) {
    await dbRun('ROLLBACK');
    console.error('Erro ao atualizar permissões:', error);
    res.status(500).json({ error: 'Erro ao atualizar permissões' });
  }
});

// ==================== POPs API (com autenticação) ====================

app.get('/api/pops/:client', auth.requireAuth(db), auth.requirePermission(auth.RESOURCES.POPS, auth.PERMISSION_LEVELS.READ), async (req, res) => {
  try {
    const { client } = req.params;
    const rows = await dbAll(
      'SELECT id, client, filename, title, category, icon, data, created_at, updated_at FROM pops WHERE client = ? ORDER BY title',
      [client]
    );
    
    const pops = rows.map(row => ({
      ...JSON.parse(row.data),
      filename: row.filename,
      _meta: { id: row.id, created_at: row.created_at, updated_at: row.updated_at }
    }));
    
    res.json(pops);
  } catch (error) {
    console.error('Erro ao listar POPs:', error);
    res.status(500).json({ error: 'Erro ao listar POPs' });
  }
});

app.post('/api/pops/:client', auth.requireAuth(db), auth.requirePermission(auth.RESOURCES.POPS, auth.PERMISSION_LEVELS.WRITE), async (req, res) => {
  try {
    const { client } = req.params;
    const popData = req.body;
    const filename = `${popData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.json`;
    
    const result = await dbRun(
      `INSERT INTO pops (client, filename, title, category, icon, data, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [client, filename, popData.title, popData.category, popData.icon, JSON.stringify(popData), req.user.id]
    );
    
    res.status(201).json({ id: result.lastID, filename, message: 'POP criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar POP:', error);
    res.status(500).json({ error: 'Erro ao criar POP' });
  }
});

// ... (outros endpoints de POPs com autenticação)

// ==================== Escalas API (com autenticação) ====================

app.get('/api/escalas/analysts', auth.requireAuth(db), auth.requirePermission(auth.RESOURCES.ESCALAS, auth.PERMISSION_LEVELS.READ), async (req, res) => {
  try {
    const rows = await dbAll('SELECT id, name, role, phone, email, active FROM analysts ORDER BY name');
    const analysts = rows.map(row => ({ ...row, active: row.active === 1 }));
    res.json(analysts);
  } catch (error) {
    console.error('Erro ao obter analistas:', error);
    res.status(500).json({ error: 'Erro ao obter analistas' });
  }
});

// ... (outros endpoints de escalas com autenticação)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mode: MODE,
    database: db ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('========================================');
    console.log(`✓ Servidor rodando na porta ${PORT}`);
    console.log(`✓ Modo: ${MODE}`);
    console.log(`✓ Database: ${DB_PATH}`);
    console.log(`✓ Acesse: http://localhost:${PORT}`);
    console.log('========================================');
  });
}).catch(error => {
  console.error('Erro ao inicializar servidor:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nEncerrando servidor...');
  if (db) {
    db.close((err) => {
      if (err) console.error('Erro ao fechar banco:', err);
      else console.log('✓ Banco de dados fechado');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
