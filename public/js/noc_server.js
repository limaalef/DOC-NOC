const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Garantir que o diretório de dados existe
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// Função auxiliar para ler arquivo JSON
async function readJSON(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

// Função auxiliar para escrever arquivo JSON
async function writeJSON(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ==================== POPs API ====================

// GET: Listar todos os POPs de um cliente
app.get('/api/pops/:client', async (req, res) => {
    try {
        const { client } = req.params;
        const manifestPath = path.join(DATA_DIR, 'pops', client, 'manifest.json');
        
        const manifest = await readJSON(manifestPath);
        if (!manifest) {
            return res.json({ files: [] });
        }

        const pops = [];
        for (const file of manifest.files) {
            const popPath = path.join(DATA_DIR, 'pops', client, file);
            const pop = await readJSON(popPath);
            if (pop) {
                pop.filename = file;
                pops.push(pop);
            }
        }

        res.json(pops);
    } catch (error) {
        console.error('Erro ao listar POPs:', error);
        res.status(500).json({ error: 'Erro ao listar POPs' });
    }
});

// GET: Obter um POP específico
app.get('/api/pops/:client/:filename', async (req, res) => {
    try {
        const { client, filename } = req.params;
        const popPath = path.join(DATA_DIR, 'pops', client, filename);
        
        const pop = await readJSON(popPath);
        if (!pop) {
            return res.status(404).json({ error: 'POP não encontrado' });
        }

        res.json(pop);
    } catch (error) {
        console.error('Erro ao obter POP:', error);
        res.status(500).json({ error: 'Erro ao obter POP' });
    }
});

// POST: Criar novo POP
app.post('/api/pops/:client', async (req, res) => {
    try {
        const { client } = req.params;
        const popData = req.body;
        
        // Gerar nome do arquivo
        const filename = `${popData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.json`;
        const clientDir = path.join(DATA_DIR, 'pops', client);
        
        // Criar diretório do cliente se não existir
        await fs.mkdir(clientDir, { recursive: true });
        
        const popPath = path.join(clientDir, filename);
        
        // Verificar se já existe
        const existing = await readJSON(popPath);
        if (existing) {
            return res.status(409).json({ error: 'POP já existe' });
        }

        // Salvar POP
        await writeJSON(popPath, popData);
        
        // Atualizar manifest
        const manifestPath = path.join(clientDir, 'manifest.json');
        let manifest = await readJSON(manifestPath) || { files: [] };
        
        if (!manifest.files.includes(filename)) {
            manifest.files.push(filename);
            await writeJSON(manifestPath, manifest);
        }

        res.status(201).json({ filename, message: 'POP criado com sucesso' });
    } catch (error) {
        console.error('Erro ao criar POP:', error);
        res.status(500).json({ error: 'Erro ao criar POP' });
    }
});

// PUT: Atualizar POP existente
app.put('/api/pops/:client/:filename', async (req, res) => {
    try {
        const { client, filename } = req.params;
        const popData = req.body;
        const popPath = path.join(DATA_DIR, 'pops', client, filename);
        
        // Verificar se existe
        const existing = await readJSON(popPath);
        if (!existing) {
            return res.status(404).json({ error: 'POP não encontrado' });
        }

        // Atualizar
        await writeJSON(popPath, popData);
        
        res.json({ message: 'POP atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar POP:', error);
        res.status(500).json({ error: 'Erro ao atualizar POP' });
    }
});

// DELETE: Excluir POP
app.delete('/api/pops/:client/:filename', async (req, res) => {
    try {
        const { client, filename } = req.params;
        const clientDir = path.join(DATA_DIR, 'pops', client);
        const popPath = path.join(clientDir, filename);
        
        // Excluir arquivo
        await fs.unlink(popPath);
        
        // Atualizar manifest
        const manifestPath = path.join(clientDir, 'manifest.json');
        let manifest = await readJSON(manifestPath);
        
        if (manifest) {
            manifest.files = manifest.files.filter(f => f !== filename);
            await writeJSON(manifestPath, manifest);
        }

        res.json({ message: 'POP excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir POP:', error);
        res.status(500).json({ error: 'Erro ao excluir POP' });
    }
});

// ==================== Escalas API ====================

// GET: Obter analistas
app.get('/api/escalas/analysts', async (req, res) => {
    try {
        const filePath = path.join(DATA_DIR, 'escalas', 'analysts.json');
        const analysts = await readJSON(filePath) || [];
        res.json(analysts);
    } catch (error) {
        console.error('Erro ao obter analistas:', error);
        res.status(500).json({ error: 'Erro ao obter analistas' });
    }
});

// POST: Salvar analistas
app.post('/api/escalas/analysts', async (req, res) => {
    try {
        const analysts = req.body;
        const escalasDir = path.join(DATA_DIR, 'escalas');
        await fs.mkdir(escalasDir, { recursive: true });
        
        const filePath = path.join(escalasDir, 'analysts.json');
        await writeJSON(filePath, analysts);
        
        res.json({ message: 'Analistas salvos com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar analistas:', error);
        res.status(500).json({ error: 'Erro ao salvar analistas' });
    }
});

// GET: Obter turnos
app.get('/api/escalas/shifts', async (req, res) => {
    try {
        const filePath = path.join(DATA_DIR, 'escalas', 'shifts.json');
        const shifts = await readJSON(filePath) || [];
        res.json(shifts);
    } catch (error) {
        console.error('Erro ao obter turnos:', error);
        res.status(500).json({ error: 'Erro ao obter turnos' });
    }
});

// POST: Salvar turnos
app.post('/api/escalas/shifts', async (req, res) => {
    try {
        const shifts = req.body;
        const escalasDir = path.join(DATA_DIR, 'escalas');
        await fs.mkdir(escalasDir, { recursive: true });
        
        const filePath = path.join(escalasDir, 'shifts.json');
        await writeJSON(filePath, shifts);
        
        res.json({ message: 'Turnos salvos com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar turnos:', error);
        res.status(500).json({ error: 'Erro ao salvar turnos' });
    }
});

// GET: Obter escalas
app.get('/api/escalas/schedules', async (req, res) => {
    try {
        const filePath = path.join(DATA_DIR, 'escalas', 'schedules.json');
        const schedules = await readJSON(filePath) || [];
        res.json(schedules);
    } catch (error) {
        console.error('Erro ao obter escalas:', error);
        res.status(500).json({ error: 'Erro ao obter escalas' });
    }
});

// POST: Salvar escalas
app.post('/api/escalas/schedules', async (req, res) => {
    try {
        const schedules = req.body;
        const escalasDir = path.join(DATA_DIR, 'escalas');
        await fs.mkdir(escalasDir, { recursive: true });
        
        const filePath = path.join(escalasDir, 'schedules.json');
        await writeJSON(filePath, schedules);
        
        res.json({ message: 'Escalas salvas com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar escalas:', error);
        res.status(500).json({ error: 'Erro ao salvar escalas' });
    }
});

// Iniciar servidor
ensureDataDir().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        console.log(`Acesse: http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error('Erro ao inicializar servidor:', error);
    process.exit(1);
});
