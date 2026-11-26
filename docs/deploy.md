# Deploy em VPS (KingHost ou qualquer Linux com Docker)

Toda a stack roda em contêineres, definida em [`deploy/docker-compose.prod.yml`](../deploy/docker-compose.prod.yml):

```
Internet ──443/80──▶ caddy ──▶ api:3000 ──▶ db (PostGIS, sem porta exposta)
                          └──▶ web:3001 ──▶ api (rede interna)
migrate: roda as migrações e sai antes da API subir
backup:  pg_dump diário em deploy/backups/, com retenção
```

Alvo de referência: **VPS KingHost, Ubuntu 24.04 LTS, 4 GB de RAM, 2 vCPU, 70 GB**. Os limites
de memória e o ajuste do PostgreSQL no compose já estão calibrados para ela. Mínimo aceitável:
2 GB de RAM com swap (o build do painel Next.js consome memória) e portas 80/443 liberadas.

Orçamento de memória na VPS de 4 GB:

| Serviço | Limite |
|---|---|
| PostgreSQL/PostGIS | 1,5 GB (shared_buffers 512 MB) |
| API | 512 MB |
| Painel | 512 MB |
| Caddy + backup + sistema | ~1,5 GB restantes |

## 1. Preparar a VPS (uma vez)

Acesse por SSH com **chave**, não senha. Na sua máquina: `ssh-keygen -t ed25519` e cadastre a
chave pública no painel da KingHost (ou com `ssh-copy-id`).

```bash
# Usuário próprio para o deploy (não use root no dia a dia)
adduser lume && usermod -aG sudo lume

# Fuso horário (logs e backups em horário de Brasília)
sudo timedatectl set-timezone America/Sao_Paulo

# Atualizações e firewall: só SSH, HTTP e HTTPS
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw fail2ban unattended-upgrades git
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
sudo ufw enable

# Opcional: liberar SSH só para o seu IP fixo. NÃO faça isso se o IP da sua internet muda
# (a maioria das conexões residenciais): você ficaria trancado para fora.
# sudo ufw delete allow OpenSSH && sudo ufw allow from SEU_IP_FIXO to any port 22 proto tcp

# Desligar login por senha e de root no SSH (depois de confirmar que a chave funciona!)
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Docker oficial
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker lume   # saia e entre de novo no SSH

# Swap de 2 GB: rede de segurança para o build das imagens (recomendado mesmo com 4 GB)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

> KingHost: se o painel da VPS tiver firewall próprio, libere 80, 443 (TCP e UDP) e 22 lá também.
>
> Atenção: o Docker publica portas por fora do UFW. Por isso o compose de produção só publica
> 80/443 (Caddy); o banco não tem `ports`.

## 2. DNS

Crie dois registros **A** apontando para o IP da VPS, por exemplo `api.seudominio.com.br` e
`painel.seudominio.com.br`. Sem domínio ainda, use o [sslip.io](https://sslip.io), que resolve
`api.203-0-113-10.sslip.io` para `203.0.113.10` e já funciona com HTTPS.

## 3. Primeiro deploy

```bash
git clone https://github.com/<sua-conta>/L.U.M.E.git lume && cd lume
cp .env.production.example .env.production
openssl rand -hex 24          # cole como POSTGRES_PASSWORD
openssl rand -hex 32          # cole como JWT_ACCESS_SECRET
nano .env.production          # domínios, e-mail, chave do Google
chmod 600 .env.production

# Atalho para os comandos abaixo (coloque no ~/.bashrc para ficar permanente)
alias lume='docker compose -f ~/lume/deploy/docker-compose.prod.yml --env-file ~/lume/.env.production'

lume up -d --build
lume ps
curl https://api.seudominio.com.br/v1/health
```

A API **recusa subir** em produção com senha padrão do banco, segredo JWT fraco, CORS
aberto/localhost ou sem contato para o OpenStreetMap. A mensagem aparece em `logs api`.

### Primeiro administrador

Não existe cadastro público de admin. Crie pela linha de comando (a senha é pedida sem eco):

```bash
lume run --rm -it -e ADMIN_EMAIL=voce@seudominio.com.br -e ADMIN_NAME="Seu Nome"   api node dist/database/create-admin.js
```

Se o e-mail já tiver conta, ela só é promovida a administrador.

Dados de demonstração **não** entram em produção (o seed recusa `NODE_ENV=production`).

## 4. Atualizar

```bash
cd ~/lume && git pull
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build
docker image prune -f
```

As migrações novas rodam sozinhas antes da API reiniciar; se uma falhar, a versão nova não sobe
(`logs migrate` mostra o motivo).


## Backup e restauração

O serviço `backup` grava `deploy/backups/lume-AAAAMMDDTHHMMSSZ.dump` todo dia e apaga os mais
antigos que `BACKUP_KEEP_DAYS`. **Backup só na própria VPS não protege contra perda da VPS**:
copie para fora regularmente, por exemplo da sua máquina:

```bash
scp lume@IP_DA_VPS:~/lume/deploy/backups/$(ssh lume@IP_DA_VPS 'ls -t ~/lume/deploy/backups | head -1') .
```

Restaurar (substitui os dados atuais):

```bash
lume stop api web
lume exec -T db pg_restore -U lume -d lume --clean --if-exists --no-owner < deploy/backups/ARQUIVO.dump
lume start api web
```

Teste a restauração de vez em quando: backup que nunca foi restaurado não é backup.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Caddy não emite certificado | DNS ainda não propagou ou portas 80/443 fechadas no firewall da KingHost |
| `api` reiniciando | Configuração insegura recusada: veja `lume logs api` |
| Build do `web` morre sem erro | Falta de memória: crie swap (passo 1) |
| Painel mostra "API fora do ar" | `lume ps`: a API está `healthy`? |
