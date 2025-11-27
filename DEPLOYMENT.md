# Guia de Deployment - NOC Dashboard v2.0 (SQLite)

## 🆕 Novidades da Versão 2.0

- ✅ **Banco de dados SQLite** - Substituiu armazenamento em JSON
- ✅ **Performance melhorada** - Consultas mais rápidas
- ✅ **Integridade de dados** - Constraints e foreign keys
- ✅ **Backup automatizado** - Backup diário às 3h
- ✅ **Script de migração** - Migra dados JSON antigos automaticamente
- ✅ **Transações** - Operações atômicas e seguras

## 📋 Pré-requisitos

- Ubuntu Server 20.04 LTS ou superior
- Acesso root ou sudo
- Conexão com internet
- Pelo menos 1GB de RAM
- 10GB de espaço em disco (para backups)

## 🚀 Instalação Nova (Sem dados existentes)

### 1. Preparar o Servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install git -y
```

### 2. Fazer Download dos Arquivos

```bash
mkdir ~/noc-deploy
cd ~/noc-deploy

# Copiar seus arquivos aqui
```

### 3. Executar Instalação Automática

```bash
chmod +x install.sh
sudo ./install.sh
```

### 4. Copiar Arquivos da Aplicação

```bash
# Backend
sudo cp server.js /opt/noc-dashboard/
sudo cp migrate-to-db.js /opt/noc-dashboard/
sudo cp backup-db.js /opt/noc-dashboard/

# Frontend
sudo cp -r public/* /opt/noc-dashboard/public/

# Ajustar permissões
sudo chown -R noc:noc /opt/noc-dashboard
```

### 5. Iniciar o Serviço

```bash
sudo systemctl start noc-dashboard
sudo systemctl status noc-dashboard
```

### 6. Acessar

```
http://seu-servidor-ip
```

## 🔄 Migração de Instalação Antiga (JSON → SQLite)

Se você já tem dados no formato JSON, siga este processo:

### 1. Fazer Backup dos Dados Antigos

```bash
# Fazer backup completo dos dados JSON
sudo tar -czf ~/noc-json-backup-$(date +%Y%m%d).tar.gz /opt/noc-dashboard/data

# Ou se estiver em outra máquina, copiar para o servidor novo
scp -r /caminho/antigo/data/* usuario@servidor-novo:~/data-old/
```

### 2. Instalar Nova Versão

```bash
# Executar instalação normalmente
sudo ./install.sh

# Copiar arquivos da aplicação
sudo cp server.js /opt/noc-dashboard/
sudo cp migrate-to-db.js /opt/noc-dashboard/
sudo cp backup-db.js /opt/noc-dashboard/
sudo cp -r public/* /opt/noc-dashboard/public/
```

### 3. Preparar Dados para Migração

```bash
# Se os dados antigos estão no servidor
sudo mkdir -p /opt/noc-dashboard/data-old
sudo cp -r /caminho/dos/dados/antigos/* /opt/noc-dashboard/data-old/

# Ou se copiou para home
sudo cp -r ~/data-old /opt/noc-dashboard/
```

### 4. Executar Migração

```bash
cd /opt/noc-dashboard

# Executar script de migração
sudo -u noc node migrate-to-db.js ./data-old ./data/noc.db

# Ou usar npm script
sudo -u noc npm run migrate
```

### 5. Verificar Migração

```bash
# Ver resumo da migração (já aparece ao final do script)
# Verificar se o banco foi criado
ls -lh /opt/noc-dashboard/data/noc.db

# Tamanho deve ser > 0 bytes
```

### 6. Iniciar Serviço

```bash
sudo systemctl start noc-dashboard
sudo systemctl status noc-dashboard

# Ver logs em tempo real
sudo journalctl -u noc-dashboard -f
```

### 7. Testar

Acesse o sistema e verifique se todos os dados foram migrados:
- POPs de todos os clientes
- Analistas
- Turnos
- Escalas

### 8. Limpar Dados Antigos (Opcional)

**ATENÇÃO: Só faça isso após confirmar que tudo está funcionando!**

```bash
# Mover dados antigos para backup
sudo mv /opt/noc-dashboard/data-old /opt/noc-dashboard/data-old.backup

# Ou remover completamente
# sudo rm -rf /opt/noc-dashboard/data-old
```

## 📁 Estrutura de Diretórios

```
/opt/noc-dashboard/
├── server.js              # Backend Node.js com SQLite
├── migrate-to-db.js       # Script de migração
├── backup-db.js          # Script de backup
├── package.json          # Dependências (com sqlite3)
├── data/                 # Dados (SQLite)
│   └── noc.db           # Banco de dados
├── backups/             # Backups automáticos
│   └── noc-backup-*.db
└── public/              # Frontend (sem mudanças)
    ├── css/
    ├── js/
    └── *.html
```

## 🗄️ Estrutura do Banco de Dados

### Tabela: pops
```sql
id              INTEGER PRIMARY KEY
client          TEXT NOT NULL
filename        TEXT NOT NULL
title           TEXT NOT NULL
category        TEXT
icon            TEXT
data            TEXT NOT NULL (JSON completo)
created_at      DATETIME
updated_at      DATETIME
```

### Tabela: analysts
```sql
id              INTEGER PRIMARY KEY
name            TEXT NOT NULL
role            TEXT NOT NULL
phone           TEXT NOT NULL
email           TEXT
active          INTEGER (0 ou 1)
created_at      DATETIME
updated_at      DATETIME
```

### Tabela: shifts
```sql
id              INTEGER PRIMARY KEY
name            TEXT NOT NULL
start_time      TEXT NOT NULL
end_time        TEXT NOT NULL
color           TEXT NOT NULL
created_at      DATETIME
updated_at      DATETIME
```

### Tabela: schedules
```sql
id              INTEGER PRIMARY KEY
date            TEXT NOT NULL
shift_id        INTEGER (FK → shifts.id)
analyst_id      INTEGER (FK → analysts.id)
created_at      DATETIME
updated_at      DATETIME
```

## 🔧 Comandos Úteis

### Gerenciar Serviço

```bash
# Iniciar
sudo systemctl start noc-dashboard

# Parar
sudo systemctl stop noc-dashboard

# Reiniciar
sudo systemctl restart noc-dashboard

# Status
sudo systemctl status noc-dashboard

# Logs
sudo journalctl -u noc-dashboard -f
sudo journalctl -u noc-dashboard -n 100 --no-pager
```

### Backup Manual

```bash
cd /opt/noc-dashboard
sudo -u noc node backup-db.js

# Ou via npm
sudo -u noc npm run backup
```

### Ver Backups

```bash
ls -lh /opt/noc-dashboard/backups/
```

### Restaurar Backup

```bash
# Parar serviço
sudo systemctl stop noc-dashboard

# Fazer backup do banco atual (precaução)
sudo cp /opt/noc-dashboard/data/noc.db /opt/noc-dashboard/data/noc.db.before-restore

# Restaurar
sudo cp /opt/noc-dashboard/backups/noc-backup-2025-11-25T15-30-00.db /opt/noc-dashboard/data/noc.db

# Ajustar permissões
sudo chown noc:noc /opt/noc-dashboard/data/noc.db

# Reiniciar
sudo systemctl start noc-dashboard
```

### Acessar Banco Diretamente

```bash
# Instalar sqlite3 se necessário
sudo apt install sqlite3

# Abrir banco
sudo sqlite3 /opt/noc-dashboard/data/noc.db

# Comandos SQLite úteis:
.tables              # Listar tabelas
.schema pops         # Ver estrutura da tabela
SELECT COUNT(*) FROM pops;           # Contar POPs
SELECT COUNT(*) FROM analysts;       # Contar analistas
.exit                # Sair
```

### Verificar Integridade do Banco

```bash
sudo sqlite3 /opt/noc-dashboard/data/noc.db "PRAGMA integrity_check;"
# Deve retornar: ok
```

## 📊 Monitoramento

### Ver Tamanho do Banco

```bash
du -h /opt/noc-dashboard/data/noc.db
```

### Ver Estatísticas

```bash
sudo sqlite3 /opt/noc-dashboard/data/noc.db <<EOF
SELECT 'POPs', COUNT(*) FROM pops
UNION ALL
SELECT 'Analistas', COUNT(*) FROM analysts
UNION ALL
SELECT 'Turnos', COUNT(*) FROM shifts
UNION ALL
SELECT 'Escalas', COUNT(*) FROM schedules;
EOF
```

## 🔒 Segurança

### Permissões do Banco

```bash
# Verificar permissões
ls -l /opt/noc-dashboard/data/

# Devem ser:
# drwxrwxr-x noc noc (diretório data)
# -rw-r--r-- noc noc (arquivo noc.db)

# Corrigir se necessário
sudo chown -R noc:noc /opt/noc-dashboard/data
sudo chmod 775 /opt/noc-dashboard/data
sudo chmod 664 /opt/noc-dashboard/data/noc.db
```

### Backup Remoto (Recomendado)

```bash
# Criar script de backup remoto
sudo nano /usr/local/bin/noc-remote-backup.sh
```

```bash
#!/bin/bash
BACKUP_FILE="/opt/noc-dashboard/backups/noc-backup-$(date +%Y%m%d-%H%M%S).db"
REMOTE_SERVER="backup@servidor-backup.com"
REMOTE_PATH="/backups/noc/"

# Criar backup local
cd /opt/noc-dashboard
node backup-db.js

# Enviar para servidor remoto
scp "$BACKUP_FILE" "$REMOTE_SERVER:$REMOTE_PATH"

echo "Backup enviado para servidor remoto"
```

```bash
# Tornar executável
sudo chmod +x /usr/local/bin/noc-remote-backup.sh

# Adicionar ao cron
sudo crontab -e
# Adicionar linha:
# 0 4 * * * /usr/local/bin/noc-remote-backup.sh >> /var/log/noc-remote-backup.log 2>&1
```

## 🆘 Troubleshooting

### Erro: "database is locked"

```bash
# Verificar se há processos usando o banco
sudo lsof /opt/noc-dashboard/data/noc.db

# Se necessário, reiniciar serviço
sudo systemctl restart noc-dashboard
```

### Erro: "unable to open database file"

```bash
# Verificar se o arquivo existe
ls -l /opt/noc-dashboard/data/noc.db

# Verificar permissões
sudo chown noc:noc /opt/noc-dashboard/data/noc.db
sudo chmod 664 /opt/noc-dashboard/data/noc.db

# Verificar permissões do diretório
sudo chmod 775 /opt/noc-dashboard/data
```

### Banco corrompido

```bash
# Verificar integridade
sudo sqlite3 /opt/noc-dashboard/data/noc.db "PRAGMA integrity_check;"

# Se corrompido, restaurar backup mais recente
sudo systemctl stop noc-dashboard
sudo cp /opt/noc-dashboard/backups/noc-backup-[mais-recente].db /opt/noc-dashboard/data/noc.db
sudo chown noc:noc /opt/noc-dashboard/data/noc.db
sudo systemctl start noc-dashboard
```

### Migração falhou parcialmente

```bash
# Ver quais dados foram migrados
sudo sqlite3 /opt/noc-dashboard/data/noc.db <<EOF
SELECT 'POPs', COUNT(*) FROM pops
UNION ALL
SELECT 'Analistas', COUNT(*) FROM analysts
UNION ALL
SELECT 'Turnos', COUNT(*) FROM shifts
UNION ALL
SELECT 'Escalas', COUNT(*) FROM schedules;
EOF

# Limpar banco e refazer migração
sudo systemctl stop noc-dashboard
sudo rm /opt/noc-dashboard/data/noc.db
sudo -u noc node /opt/noc-dashboard/migrate-to-db.js ./data-old ./data/noc.db
sudo systemctl start noc-dashboard
```

## 🔄 Atualização de Versão

### Atualizar de v2.0.x para v2.0.y

```bash
# 1. Fazer backup
cd /opt/noc-dashboard
sudo -u noc npm run backup

# 2. Parar serviço
sudo systemctl stop noc-dashboard

# 3. Atualizar código
sudo cp /caminho/novos/arquivos/* /opt/noc-dashboard/

# 4. Atualizar dependências
sudo -u noc npm install

# 5. Reiniciar
sudo systemctl start noc-dashboard
```

## 🔄 Rollback para Versão JSON (Emergência)

Se precisar voltar para a versão antiga:

```bash
# 1. Parar novo serviço
sudo systemctl stop noc-dashboard
sudo systemctl disable noc-dashboard

# 2. Exportar dados do SQLite para JSON (criar script se necessário)
# Ou restaurar backup JSON antigo

# 3. Reinstalar versão v1.0
# ... (usar instalação antiga)
```

## 📞 Suporte

Para problemas ou dúvidas:
- Verificar logs: `sudo journalctl -u noc-dashboard -f`
- Verificar integridade do banco
- Restaurar backup mais recente
- Contatar equipe de TI

---

**IT Universe Tecnologia da Informação LTDA**  
CNPJ: 12.056.887/0001-19  
Rua Narciso Sturlini, 62 – Centro – Osasco/SP
