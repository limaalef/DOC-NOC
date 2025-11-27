# NOC Dashboard - IT Universe

Sistema web completo para gestão de Procedimentos Operacionais Padrão (POPs) e Escalas de Plantão do NOC.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![Database](https://img.shields.io/badge/database-SQLite-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## 🆕 Novidades v2.0

- ✅ **Banco de dados SQLite** - Substituiu JSON por banco relacional
- ✅ **Performance melhorada** - Consultas indexadas e otimizadas
- ✅ **Backup automático** - Backup diário configurado via cron
- ✅ **Script de migração** - Migra dados JSON → SQLite automaticamente
- ✅ **Integridade de dados** - Foreign keys e constraints
- ✅ **Transações atômicas** - Operações seguras e consistentes

## 🎯 Funcionalidades

### POPs (Procedimentos Operacionais Padrão)
- ✅ Visualização de POPs organizados por cliente
- ✅ Busca e filtros avançados
- ✅ Categorização por tipo (Rede, Infraestrutura, Cloud, Database)
- ✅ Procedimentos passo a passo com detalhes ricos:
  - Texto simples
  - Citações
  - Contatos com telefone
  - Menus de navegação (estilo Zabbix)
  - Alertas Zabbix com severidades
- ✅ Integração com AnyDesk
- ✅ Interface de administração completa

### Escalas de Plantão
- ✅ Calendário semanal visual
- ✅ Gestão de analistas e turnos
- ✅ Múltiplos tipos de escala (12x36, 6x1, 5x2, etc.)
- ✅ Contatos de emergência
- ✅ Interface administrativa completa

### Características Técnicas
- 🔄 Sincronização em tempo real entre usuários
- 💾 Persistência de dados em servidor
- 🌓 Modo escuro/claro
- 📱 Design responsivo
- 🖨️ Suporte a impressão
- 🔒 Pronto para autenticação (extensível)

## 🏗️ Arquitetura

```
┌─────────────┐     HTTP/REST      ┌──────────────┐
│   Browser   │ ◄─────────────────► │  Node.js     │
│  (Frontend) │                     │  Express API │
└─────────────┘                     └──────────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │    SQLite    │
                                    │   Database   │
                                    └──────────────┘
```

### Backend (Node.js + Express + SQLite)
- RESTful API
- SQLite para persistência
- Transações e integridade referencial
- Backup automatizado

### Frontend
- Vanilla JavaScript (sem frameworks pesados)
- Cliente API reutilizável
- Código modular e organizado

### Banco de Dados (SQLite)
- **POPs**: Armazenamento de procedimentos por cliente
- **Analysts**: Cadastro de analistas NOC
- **Shifts**: Definição de turnos
- **Schedules**: Escalas de plantão
- Índices otimizados para performance

## 📋 Requisitos

- **Sistema Operacional**: Ubuntu Server 20.04+ (ou similar)
- **Node.js**: v18.0.0 ou superior
- **NPM**: v9.0.0 ou superior
- **SQLite**: v3.x (instalado automaticamente via npm)
- **Nginx**: (incluído na instalação)
- **Build tools**: gcc, g++, make (para compilar sqlite3)
- **Memória RAM**: Mínimo 1GB
- **Disco**: 10GB livres (incluindo espaço para backups)

## 🚀 Instalação

### Instalação Nova (Recomendado)

```bash
# 1. Download dos arquivos
git clone https://github.com/seu-usuario/noc-dashboard.git
cd noc-dashboard

# 2. Executar instalação
chmod +x install.sh
sudo ./install.sh

# 3. Copiar arquivos
sudo cp server.js /opt/noc-dashboard/
sudo cp migrate-to-db.js /opt/noc-dashboard/
sudo cp backup-db.js /opt/noc-dashboard/
sudo cp -r public/* /opt/noc-dashboard/public/

# 4. Ajustar permissões
sudo chown -R noc:noc /opt/noc-dashboard

# 5. Iniciar serviço
sudo systemctl start noc-dashboard
```

### Migração de Versão Antiga (JSON → SQLite)

Se você já tem dados no formato JSON:

```bash
# 1. Fazer backup dos dados antigos
sudo tar -czf ~/noc-json-backup-$(date +%Y%m%d).tar.gz /opt/noc-dashboard-old/data

# 2. Instalar nova versão
sudo ./install.sh
# (copiar arquivos conforme acima)

# 3. Copiar dados antigos
sudo cp -r /opt/noc-dashboard-old/data /opt/noc-dashboard/data-old

# 4. Executar migração
cd /opt/noc-dashboard
sudo -u noc node migrate-to-db.js ./data-old ./data/noc.db

# 5. Verificar migração e iniciar
sudo systemctl start noc-dashboard
```

### Instalação Manual

Consulte [DEPLOYMENT-SQLite.md](DEPLOYMENT-SQLite.md) para instruções detalhadas.

## 📖 Uso

### Acessar o Sistema

Após a instalação, acesse pelo navegador:
```
http://seu-servidor-ip
```

### Estrutura de URLs

- `/` - Dashboard principal
- `/pop.html` - Visualizar POPs
- `/pop.html?client=caldic` - POPs de cliente específico
- `/pop-admin.html` - Administração de POPs
- `/escalas.html` - Visualizar escalas
- `/escalas-admin.html` - Administração de escalas

## 🔧 Configuração

### Adicionar Novo Cliente

1. Edite `server.js` e adicione o cliente ao array `CLIENTS`
2. Crie o diretório: `mkdir -p data/pops/novo-cliente`
3. Crie o manifest: `echo '{"files":[]}' > data/pops/novo-cliente/manifest.json`
4. Reinicie: `sudo systemctl restart noc-dashboard`

### Configurar Porta

Edite `/etc/systemd/system/noc-dashboard.service`:
```ini
Environment=PORT=8080
```

Reinicie:
```bash
sudo systemctl daemon-reload
sudo systemctl restart noc-dashboard
```

## 📡 API Endpoints

### POPs

```
GET    /api/pops/:client          # Listar POPs
GET    /api/pops/:client/:file    # Obter POP específico
POST   /api/pops/:client          # Criar POP
PUT    /api/pops/:client/:file    # Atualizar POP
DELETE /api/pops/:client/:file    # Deletar POP
```

### Escalas

```
GET    /api/escalas/analysts      # Listar analistas
POST   /api/escalas/analysts      # Salvar analistas (batch)
GET    /api/escalas/shifts        # Listar turnos
POST   /api/escalas/shifts        # Salvar turnos (batch)
GET    /api/escalas/schedules     # Listar escalas
POST   /api/escalas/schedules     # Salvar escalas (batch)
```

### Sistema

```
GET    /api/health                # Health check
```

## 💾 Backup e Restauração

### Backup Automático

O sistema está configurado para fazer backup automático diariamente às 3h:

```bash
# Ver logs de backup
tail -f /var/log/noc-backup.log

# Ver backups disponíveis
ls -lh /opt/noc-dashboard/backups/
```

### Backup Manual

```bash
cd /opt/noc-dashboard
sudo -u noc npm run backup
```

### Restaurar Backup

```bash
# Parar serviço
sudo systemctl stop noc-dashboard

# Restaurar
sudo cp /opt/noc-dashboard/backups/noc-backup-YYYYMMDD-HHMMSS.db \
        /opt/noc-dashboard/data/noc.db

# Ajustar permissões
sudo chown noc:noc /opt/noc-dashboard/data/noc.db

# Reiniciar
sudo systemctl start noc-dashboard
```

## 🗄️ Gerenciamento do Banco de Dados

### Acessar SQLite

```bash
sudo sqlite3 /opt/noc-dashboard/data/noc.db

# Comandos úteis:
.tables                          # Listar tabelas
.schema tablename                # Ver estrutura
SELECT COUNT(*) FROM pops;       # Contar registros
.exit                           # Sair
```

### Verificar Integridade

```bash
sudo sqlite3 /opt/noc-dashboard/data/noc.db "PRAGMA integrity_check;"
```

### Estatísticas

```bash
cd /opt/noc-dashboard
sudo -u noc node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/noc.db');
db.all(\`
  SELECT 'POPs' as tipo, COUNT(*) as total FROM pops
  UNION ALL SELECT 'Analistas', COUNT(*) FROM analysts
  UNION ALL SELECT 'Turnos', COUNT(*) FROM shifts
  UNION ALL SELECT 'Escalas', COUNT(*) FROM schedules
\`, (err, rows) => {
  if (!err) console.table(rows);
  db.close();
});
"
```

## 🔒 Segurança

### Recomendações

1. **Firewall**: Configure UFW para permitir apenas portas necessárias
2. **SSL/HTTPS**: Use Certbot para certificado gratuito
3. **Autenticação**: Implemente autenticação básica ou JWT
4. **Backups**: Configure backups automáticos diários

Veja [DEPLOYMENT.md](DEPLOYMENT.md) para detalhes.

## 🐛 Troubleshooting

### Serviço não inicia

```bash
# Ver logs
sudo journalctl -u noc-dashboard -n 50

# Verificar permissões
sudo chown -R noc:noc /opt/noc-dashboard

# Verificar porta
sudo netstat -tlnp | grep 3000
```

### Erro ao salvar dados

```bash
# Verificar permissões do diretório data
sudo chmod -R 755 /opt/noc-dashboard/data
sudo chown -R noc:noc /opt/noc-dashboard/data
```

### Mais problemas?

Consulte a seção Troubleshooting em [DEPLOYMENT.md](DEPLOYMENT.md)

## 📦 Estrutura do Projeto

```
noc-dashboard/
├── server.js              # Backend API com SQLite
├── migrate-to-db.js      # Script de migração JSON→SQLite
├── backup-db.js          # Script de backup
├── package.json          # Dependências (incluindo sqlite3)
├── install.sh            # Script de instalação
├── README.md             # Este arquivo
├── DEPLOYMENT-SQLite.md  # Guia de deployment detalhado
├── public/               # Frontend
│   ├── index.html        # Dashboard
│   ├── pop.html          # Visualizar POPs
│   ├── pop-admin.html    # Admin POPs
│   ├── escalas.html      # Visualizar escalas
│   ├── escalas-admin.html # Admin escalas
│   ├── css/
│   │   ├── style.css
│   │   ├── admin.css
│   │   └── escalas.css
│   └── js/
│       ├── api.js         # Cliente API
│       ├── app.js         # POPs viewer
│       ├── admin.js       # POPs admin
│       ├── escalas.js     # Escalas viewer
│       └── escalas-admin.js # Escalas admin
└── data/                 # Dados (gerado na instalação)
    ├── noc.db           # Banco SQLite
    └── backups/         # Backups automáticos
        └── noc-backup-*.db
```

## 🔄 Atualizações

### Atualizar Sistema (v2.0.x → v2.0.y)

```bash
# 1. Fazer backup
cd /opt/noc-dashboard
sudo -u noc npm run backup

# 2. Parar serviço
sudo systemctl stop noc-dashboard

# 3. Atualizar código
sudo cp /caminho/novos/arquivos/*.js /opt/noc-dashboard/
sudo cp -r /caminho/novos/arquivos/public/* /opt/noc-dashboard/public/

# 4. Atualizar dependências
cd /opt/noc-dashboard
sudo -u noc npm install

# 5. Reiniciar serviço
sudo systemctl start noc-dashboard

# 6. Verificar
sudo systemctl status noc-dashboard
```

### Migrar de v1.0 (JSON) para v2.0 (SQLite)

Siga o guia completo em [DEPLOYMENT-SQLite.md](DEPLOYMENT-SQLite.md#-migração-de-instalação-antiga-json--sqlite)

## 🤝 Contribuindo

Este é um projeto interno da IT Universe. Para sugestões ou melhorias, contate a equipe de desenvolvimento.

## 📄 Licença

MIT License - IT Universe Tecnologia da Informação LTDA

## 📞 Suporte

**IT Universe Tecnologia da Informação LTDA**  
CNPJ: 12.056.887/0001-19  
Endereço: Rua Narciso Sturlini, 62 – Centro – Osasco/SP  

---

Desenvolvido com ❤️ pela equipe IT Universe
