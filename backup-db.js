#!/usr/bin/env node

/**
 * Script de Backup do Banco de Dados
 * Cria backup do banco SQLite com timestamp
 */

const fs = require('fs').promises;
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/noc.db';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

async function createBackup() {
    console.log('========================================');
    console.log('💾 Backup do Banco de Dados');
    console.log('========================================');
    
    try {
        // Verificar se banco existe
        try {
            await fs.access(DB_PATH);
        } catch {
            console.error(`❌ Banco de dados não encontrado: ${DB_PATH}`);
            process.exit(1);
        }
        
        // Criar diretório de backups se não existir
        try {
            await fs.access(BACKUP_DIR);
        } catch {
            await fs.mkdir(BACKUP_DIR, { recursive: true });
            console.log(`✓ Diretório de backups criado: ${BACKUP_DIR}`);
        }
        
        // Gerar nome do backup com timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupName = `noc-backup-${timestamp}.db`;
        const backupPath = path.join(BACKUP_DIR, backupName);
        
        // Copiar banco
        console.log(`\nCopiando banco de dados...`);
        console.log(`Origem: ${DB_PATH}`);
        console.log(`Destino: ${backupPath}`);
        
        await fs.copyFile(DB_PATH, backupPath);
        
        // Verificar tamanho
        const stats = await fs.stat(backupPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`\n✓ Backup criado com sucesso!`);
        console.log(`  Arquivo: ${backupName}`);
        console.log(`  Tamanho: ${sizeInMB} MB`);
        
        // Listar backups existentes
        const files = await fs.readdir(BACKUP_DIR);
        const backupFiles = files.filter(f => f.startsWith('noc-backup-') && f.endsWith('.db'));
        
        console.log(`\n📂 Backups disponíveis: ${backupFiles.length}`);
        
        // Limpar backups antigos (manter últimos 10)
        if (backupFiles.length > 10) {
            console.log('\n🧹 Limpando backups antigos...');
            
            // Ordenar por data (mais antigos primeiro)
            backupFiles.sort();
            const toDelete = backupFiles.slice(0, backupFiles.length - 10);
            
            for (const file of toDelete) {
                const filePath = path.join(BACKUP_DIR, file);
                await fs.unlink(filePath);
                console.log(`  ✓ Removido: ${file}`);
            }
            
            console.log(`✓ ${toDelete.length} backup(s) antigo(s) removido(s)`);
        }
        
        console.log('\n========================================');
        console.log('✓ Processo concluído');
        console.log('========================================\n');
        
    } catch (error) {
        console.error('\n❌ Erro ao criar backup:', error);
        process.exit(1);
    }
}

// Verificar argumentos
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Uso: node backup-db.js

Variáveis de Ambiente:
  DB_PATH      Caminho do banco SQLite (padrão: ./data/noc.db)
  BACKUP_DIR   Diretório para backups (padrão: ./backups)

Exemplos:
  node backup-db.js
  DB_PATH=/opt/noc-dashboard/data/noc.db node backup-db.js
  BACKUP_DIR=/backups node backup-db.js

Nota: Mantém os últimos 10 backups automaticamente.
    `);
    process.exit(0);
}

createBackup();
