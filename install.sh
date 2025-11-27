#!/bin/bash

# Script de instalação do NOC Dashboard com SQLite em Ubuntu Server
# Autor: IT Universe
# Versão: 2.0.0 (com SQLite)

set -e

echo "========================================="
echo "NOC Dashboard v2.0 - Instalação com SQLite"
echo "========================================="
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo "Por favor, execute como root (sudo ./install.sh)"
    exit 1
fi

# Variáveis
APP_DIR="/opt/noc-dashboard"
SERVICE_USER="noc"
PORT=3000

echo "1. Atualizando sistema..."
apt-get update
apt-get upgrade -y

echo ""
echo "2. Instalando dependências..."
apt-get install -y curl git nginx build-essential python3

# Instalar Node.js 20.x
if ! command -v node &> /dev/null; then
    echo "Instalando Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "Node.js versão: $(node --version)"
echo "NPM versão: $(npm --version)"

echo ""
echo "3. Criando usuário do sistema..."
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd -r -s /bin/false $SERVICE_USER
    echo "Usuário $SERVICE_USER criado"
else
    echo "Usuário $SERVICE_USER já existe"
fi

echo ""
echo "4. Criando estrutura de diretórios..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/data
mkdir -p $APP_DIR/backups
mkdir -p $APP_DIR/public/css
mkdir -p $APP_DIR/public/js

cd $APP_DIR

echo ""
echo "5. Inicializando projeto Node.js..."
if [ ! -f "package.json" ]; then
    cat > package.json <<'EOF'
{
  "name": "noc-dashboard",
  "version": "2.0.0",
  "description": "NOC Dashboard IT Universe - com SQLite",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "migrate": "node migrate-to-db.js",
    "backup": "node backup-db.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2",
    "sqlite3": "^5.1.7"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
EOF
fi

echo ""
echo "6. Instalando dependências npm..."
npm install --production

echo ""
echo "7. Configurando permissões..."
chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
chmod -R 755 $APP_DIR
chmod 775 $APP_DIR/data
chmod 775 $APP_DIR/backups

echo ""
echo "8. Criando serviço systemd..."
cat > /etc/systemd/system/noc-dashboard.service <<EOF
[Unit]
Description=NOC Dashboard IT Universe (SQLite)
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=DB_PATH=$APP_DIR/data/noc.db

# Logs
StandardOutput=journal
StandardError=journal
SyslogIdentifier=noc-dashboard

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "9. Configurando Nginx..."
cat > /etc/nginx/sites-available/noc-dashboard <<'EOF'
server {
    listen 80;
    server_name _;

    # Logs
    access_log /var/log/nginx/noc-dashboard-access.log;
    error_log /var/log/nginx/noc-dashboard-error.log;

    # Arquivos estáticos
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout maior para operações de banco
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # Aumentar tamanho máximo de upload
    client_max_body_size 10M;
}
EOF

# Habilitar site
ln -sf /etc/nginx/sites-available/noc-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

echo ""
echo "10. Configurando cron para backup automático..."
cat > /etc/cron.d/noc-backup <<EOF
# Backup diário do banco de dados NOC às 3h da manhã
0 3 * * * $SERVICE_USER cd $APP_DIR && /usr/bin/node backup-db.js >> /var/log/noc-backup.log 2>&1
EOF

chmod 644 /etc/cron.d/noc-backup

echo ""
echo "11. Habilitando serviços..."
systemctl daemon-reload
systemctl enable noc-dashboard
systemctl restart nginx

echo ""
echo "========================================="
echo "✓ Instalação concluída!"
echo "========================================="
echo ""
echo "ESTRUTURA CRIADA:"
echo "  $APP_DIR/data/          - Banco SQLite"
echo "  $APP_DIR/backups/       - Backups automáticos"
echo "  $APP_DIR/public/        - Frontend"
echo ""
echo "PRÓXIMOS PASSOS:"
echo ""
echo "1. Copiar arquivos da aplicação:"
echo "   sudo cp server.js $APP_DIR/"
echo "   sudo cp migrate-to-db.js $APP_DIR/"
echo "   sudo cp backup-db.js $APP_DIR/"
echo "   sudo cp -r public/* $APP_DIR/public/"
echo ""
echo "2. Ajustar permissões:"
echo "   sudo chown -R noc:noc $APP_DIR"
echo ""
echo "3a. NOVA INSTALAÇÃO (sem dados antigos):"
echo "    sudo systemctl start noc-dashboard"
echo ""
echo "3b. MIGRAÇÃO (com dados JSON antigos):"
echo "    - Copiar arquivos JSON antigos para $APP_DIR/data-old/"
echo "    - Executar: cd $APP_DIR && sudo -u noc node migrate-to-db.js ./data-old ./data/noc.db"
echo "    - Iniciar: sudo systemctl start noc-dashboard"
echo ""
echo "4. Verificar status:"
echo "   sudo systemctl status noc-dashboard"
echo "   sudo journalctl -u noc-dashboard -f"
echo ""
echo "5. Acessar:"
echo "   http://$(hostname -I | awk '{print $1}')"
echo ""
echo "COMANDOS ÚTEIS:"
echo "  npm run migrate  - Migrar dados JSON → SQLite"
echo "  npm run backup   - Criar backup manual"
echo ""
echo "BACKUP AUTOMÁTICO:"
echo "  Configurado para rodar diariamente às 3h"
echo "  Logs: /var/log/noc-backup.log"
echo ""
echo "========================================="
