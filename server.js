const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'noc.db');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));

// Inicializar banco de dados
let db;

async function initDatabase() {
    // Criar diretório se não existir
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
            createTables().then(resolve).catch(reject);
        });
    });
}

// Criar tabelas
async function createTables() {
    const tables = [
        // Tabela de POPs
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
            UNIQUE(client, filename)
        )`,
        
        // Tabela de Analistas
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
        
        // Tabela de Turnos
        `CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // Tabela de Escalas
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
        
        // Índices
        `CREATE INDEX IF NOT EXISTS idx_pops_client ON pops(client)`,
        `CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date)`,
        `CREATE INDEX IF NOT EXISTS idx_schedules_shift ON schedules(shift_id)`,
        `CREATE INDEX IF NOT EXISTS idx_schedules_analyst ON schedules(analyst_id)`
    ];

    for (const sql of tables) {
        await dbRun(sql);
    }
    
    console.log('✓ Tabelas criadas/verificadas');
}

// Funções auxiliares de banco de dados
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

// ==================== POPs API ====================

// GET: Listar todos os POPs de um cliente
app.get('/api/pops/:client', async (req, res) => {
    try {
        const { client } = req.params;
        const rows = await dbAll(
            'SELECT id, client, filename, title, category, icon, data, created_at, updated_at FROM pops WHERE client = ? ORDER BY title',
            [client]
        );
        
        const pops = rows.map(row => ({
            ...JSON.parse(row.data),
            filename: row.filename,
            _meta: {
                id: row.id,
                created_at: row.created_at,
                updated_at: row.updated_at
            }
        }));
        
        res.json(pops);
    } catch (error) {
        console.error('Erro ao listar POPs:', error);
        res.status(500).json({ error: 'Erro ao listar POPs', message: error.message });
    }
});

// GET: Obter um POP específico
app.get('/api/pops/:client/:filename', async (req, res) => {
    try {
        const { client, filename } = req.params;
        const row = await dbGet(
            'SELECT * FROM pops WHERE client = ? AND filename = ?',
            [client, filename]
        );
        
        if (!row) {
            return res.status(404).json({ error: 'POP não encontrado' });
        }
        
        const pop = {
            ...JSON.parse(row.data),
            filename: row.filename,
            _meta: {
                id: row.id,
                created_at: row.created_at,
                updated_at: row.updated_at
            }
        };
        
        res.json(pop);
    } catch (error) {
        console.error('Erro ao obter POP:', error);
        res.status(500).json({ error: 'Erro ao obter POP', message: error.message });
    }
});

// POST: Criar novo POP
app.post('/api/pops/:client', async (req, res) => {
    try {
        const { client } = req.params;
        const popData = req.body;
        
        // Gerar nome do arquivo
        const filename = `${popData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.json`;
        
        // Verificar se já existe
        const existing = await dbGet(
            'SELECT id FROM pops WHERE client = ? AND filename = ?',
            [client, filename]
        );
        
        if (existing) {
            return res.status(409).json({ error: 'POP já existe' });
        }
        
        // Inserir
        const result = await dbRun(
            `INSERT INTO pops (client, filename, title, category, icon, data) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [client, filename, popData.title, popData.category, popData.icon, JSON.stringify(popData)]
        );
        
        res.status(201).json({ 
            id: result.lastID,
            filename, 
            message: 'POP criado com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao criar POP:', error);
        res.status(500).json({ error: 'Erro ao criar POP', message: error.message });
    }
});

// PUT: Atualizar POP existente
app.put('/api/pops/:client/:filename', async (req, res) => {
    try {
        const { client, filename } = req.params;
        const popData = req.body;
        
        // Verificar se existe
        const existing = await dbGet(
            'SELECT id FROM pops WHERE client = ? AND filename = ?',
            [client, filename]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'POP não encontrado' });
        }
        
        // Atualizar
        await dbRun(
            `UPDATE pops 
             SET title = ?, category = ?, icon = ?, data = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE client = ? AND filename = ?`,
            [popData.title, popData.category, popData.icon, JSON.stringify(popData), client, filename]
        );
        
        res.json({ message: 'POP atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar POP:', error);
        res.status(500).json({ error: 'Erro ao atualizar POP', message: error.message });
    }
});

// DELETE: Excluir POP
app.delete('/api/pops/:client/:filename', async (req, res) => {
    try {
        const { client, filename } = req.params;
        
        const result = await dbRun(
            'DELETE FROM pops WHERE client = ? AND filename = ?',
            [client, filename]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'POP não encontrado' });
        }
        
        res.json({ message: 'POP excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir POP:', error);
        res.status(500).json({ error: 'Erro ao excluir POP', message: error.message });
    }
});

// ==================== Escalas API ====================

// GET: Obter analistas
app.get('/api/escalas/analysts', async (req, res) => {
    try {
        const rows = await dbAll(
            'SELECT id, name, role, phone, email, active FROM analysts ORDER BY name'
        );
        
        const analysts = rows.map(row => ({
            id: row.id,
            name: row.name,
            role: row.role,
            phone: row.phone,
            email: row.email,
            active: row.active === 1
        }));
        
        res.json(analysts);
    } catch (error) {
        console.error('Erro ao obter analistas:', error);
        res.status(500).json({ error: 'Erro ao obter analistas', message: error.message });
    }
});

// POST: Salvar analistas (batch update)
app.post('/api/escalas/analysts', async (req, res) => {
    try {
        const analysts = req.body;
        
        // Iniciar transação
        await dbRun('BEGIN TRANSACTION');
        
        // Limpar tabela
        await dbRun('DELETE FROM analysts');
        
        // Inserir todos
        for (const analyst of analysts) {
            await dbRun(
                `INSERT INTO analysts (id, name, role, phone, email, active) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [analyst.id, analyst.name, analyst.role, analyst.phone, analyst.email || '', analyst.active ? 1 : 0]
            );
        }
        
        await dbRun('COMMIT');
        
        res.json({ message: 'Analistas salvos com sucesso' });
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('Erro ao salvar analistas:', error);
        res.status(500).json({ error: 'Erro ao salvar analistas', message: error.message });
    }
});

// GET: Obter turnos
app.get('/api/escalas/shifts', async (req, res) => {
    try {
        const rows = await dbAll(
            'SELECT id, name, start_time, end_time, color FROM shifts ORDER BY start_time'
        );
        
        const shifts = rows.map(row => ({
            id: row.id,
            name: row.name,
            start: row.start_time,
            end: row.end_time,
            color: row.color
        }));
        
        res.json(shifts);
    } catch (error) {
        console.error('Erro ao obter turnos:', error);
        res.status(500).json({ error: 'Erro ao obter turnos', message: error.message });
    }
});

// POST: Salvar turnos (batch update)
app.post('/api/escalas/shifts', async (req, res) => {
    try {
        const shifts = req.body;
        
        await dbRun('BEGIN TRANSACTION');
        
        // Limpar tabela
        await dbRun('DELETE FROM shifts');
        
        // Inserir todos
        for (const shift of shifts) {
            await dbRun(
                `INSERT INTO shifts (id, name, start_time, end_time, color) 
                 VALUES (?, ?, ?, ?, ?)`,
                [shift.id, shift.name, shift.start, shift.end, shift.color]
            );
        }
        
        await dbRun('COMMIT');
        
        res.json({ message: 'Turnos salvos com sucesso' });
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('Erro ao salvar turnos:', error);
        res.status(500).json({ error: 'Erro ao salvar turnos', message: error.message });
    }
});

// GET: Obter escalas
app.get('/api/escalas/schedules', async (req, res) => {
    try {
        const rows = await dbAll(
            'SELECT id, date, shift_id, analyst_id FROM schedules ORDER BY date'
        );
        
        const schedules = rows.map(row => ({
            id: row.id,
            date: row.date,
            shift: row.shift_id,
            analyst: row.analyst_id
        }));
        
        res.json(schedules);
    } catch (error) {
        console.error('Erro ao obter escalas:', error);
        res.status(500).json({ error: 'Erro ao obter escalas', message: error.message });
    }
});

// POST: Salvar escalas (batch update)
app.post('/api/escalas/schedules', async (req, res) => {
    try {
        const schedules = req.body;
        
        await dbRun('BEGIN TRANSACTION');
        
        // Limpar tabela
        await dbRun('DELETE FROM schedules');
        
        // Inserir todos
        for (const schedule of schedules) {
            await dbRun(
                `INSERT INTO schedules (date, shift_id, analyst_id) 
                 VALUES (?, ?, ?)`,
                [schedule.date, schedule.shift, schedule.analyst]
            );
        }
        
        await dbRun('COMMIT');
        
        res.json({ message: 'Escalas salvas com sucesso' });
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('Erro ao salvar escalas:', error);
        res.status(500).json({ error: 'Erro ao salvar escalas', message: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        database: db ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log('========================================');
        console.log(`✓ Servidor rodando na porta ${PORT}`);
        console.log(`✓ Database: ${DB_PATH}`);
        console.log(`✓ Acesse: http://localhost:${PORT}`);
        console.log('========================================');
    });
}).catch(error => {
    console.error('Erro ao inicializar servidor:', error);
    process.exit(1);
});

// Graceful shutdown
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
