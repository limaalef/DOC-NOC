/**
 * Sistema de Autenticação e Autorização
 * Suporta Microsoft 365 OAuth2 + Permissões granulares
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Secret para JWT (deve ser configurado via env em produção)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRATION = '24h';

// Níveis de permissão
const PERMISSION_LEVELS = {
  NONE: 0,
  READ: 1,
  WRITE: 2
};

// Tipos de usuário
const USER_TYPES = {
  STANDARD: 'standard', // Usuário padrão
  FULL: 'full'         // Usuário total (admin)
};

// Recursos do sistema
const RESOURCES = {
  POPS: 'pops',
  ESCALAS: 'escalas',
  SETTINGS: 'settings',
  USERS: 'users'
};

/**
 * Gerar token JWT
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    type: user.user_type,
    active: user.active
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

/**
 * Verificar token JWT
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Middleware de autenticação
 */
function requireAuth(db) {
  return async (req, res, next) => {
    // Verificar se autenticação está habilitada
    const config = await getConfig(db, 'auth_enabled');
    
    if (!config || config.value === 'false') {
      // Autenticação desabilitada - permitir acesso
      req.user = { type: USER_TYPES.FULL, bypass: true };
      return next();
    }
    
    // Extrair token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
    
    // Verificar se usuário está ativo
    const user = await getUser(db, decoded.id);
    
    if (!user || !user.active) {
      return res.status(403).json({ error: 'Usuário inativo' });
    }
    
    // Anexar usuário à requisição
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      type: user.user_type
    };
    
    next();
  };
}

/**
 * Middleware de autorização por recurso
 */
function requirePermission(resource, level = PERMISSION_LEVELS.READ) {
  return async (req, res, next) => {
    // Se autenticação desabilitada, permitir tudo
    if (req.user && req.user.bypass) {
      return next();
    }
    
    // Usuários FULL têm acesso total
    if (req.user.type === USER_TYPES.FULL) {
      return next();
    }
    
    // Verificar permissão específica do usuário
    const db = req.app.locals.db;
    const permission = await getUserPermission(db, req.user.id, resource);
    
    if (!permission || permission < level) {
      return res.status(403).json({ 
        error: 'Permissão negada',
        required: level,
        current: permission || 0
      });
    }
    
    next();
  };
}

/**
 * Verificar código de bypass de emergência
 */
async function verifyBypassCode(db, code) {
  const config = await getConfig(db, 'bypass_code');
  
  if (!config || !config.value) {
    return false;
  }
  
  // Hash do código fornecido
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  
  return hash === config.value;
}

/**
 * Gerar novo código de bypass
 */
function generateBypassCode() {
  // Código alfanumérico de 12 caracteres
  return crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
}

/**
 * Obter configuração
 */
function getConfig(db, key) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM config WHERE key = ?', [key], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * Obter usuário por ID
 */
function getUser(db, userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * Obter permissão do usuário
 */
function getUserPermission(db, userId, resource) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT permission_level FROM user_permissions WHERE user_id = ? AND resource = ?',
      [userId, resource],
      (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.permission_level : PERMISSION_LEVELS.NONE);
      }
    );
  });
}

/**
 * Criar ou atualizar usuário após login Microsoft
 */
async function createOrUpdateUser(db, microsoftProfile) {
  return new Promise((resolve, reject) => {
    const { email, name, id: microsoft_id } = microsoftProfile;
    
    // Verificar se novos usuários estão bloqueados
    db.get('SELECT value FROM config WHERE key = ?', ['block_new_users'], (err, config) => {
      if (err) return reject(err);
      
      // Verificar se usuário já existe
      db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return reject(err);
        
        if (user) {
          // Atualizar usuário existente
          db.run(
            'UPDATE users SET name = ?, microsoft_id = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [name, microsoft_id, user.id],
            (err) => {
              if (err) return reject(err);
              resolve(user);
            }
          );
        } else {
          // Verificar se novos usuários estão bloqueados
          if (config && config.value === 'true') {
            return reject(new Error('Novos usuários estão bloqueados'));
          }
          
          // Criar novo usuário
          db.run(
            `INSERT INTO users (email, name, microsoft_id, user_type, active, last_login) 
             VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
            [email, name, microsoft_id, USER_TYPES.STANDARD],
            function(err) {
              if (err) return reject(err);
              
              const newUser = {
                id: this.lastID,
                email,
                name,
                user_type: USER_TYPES.STANDARD,
                active: 1
              };
              
              // Criar permissões padrão para novo usuário
              createDefaultPermissions(db, newUser.id).then(() => {
                resolve(newUser);
              }).catch(reject);
            }
          );
        }
      });
    });
  });
}

/**
 * Criar permissões padrão para usuário standard
 */
async function createDefaultPermissions(db, userId) {
  const defaultPermissions = [
    { resource: RESOURCES.POPS, level: PERMISSION_LEVELS.READ },
    { resource: RESOURCES.ESCALAS, level: PERMISSION_LEVELS.READ },
    { resource: RESOURCES.SETTINGS, level: PERMISSION_LEVELS.NONE },
    { resource: RESOURCES.USERS, level: PERMISSION_LEVELS.NONE }
  ];
  
  for (const perm of defaultPermissions) {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO user_permissions (user_id, resource, permission_level) VALUES (?, ?, ?)',
        [userId, perm.resource, perm.level],
        (err) => err ? reject(err) : resolve()
      );
    });
  }
}

module.exports = {
  generateToken,
  verifyToken,
  requireAuth,
  requirePermission,
  verifyBypassCode,
  generateBypassCode,
  createOrUpdateUser,
  PERMISSION_LEVELS,
  USER_TYPES,
  RESOURCES
};
