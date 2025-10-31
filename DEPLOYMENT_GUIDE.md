# 🚀 Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the hyper-resilient Sui Flash Loan DApp to production environments.

## Prerequisites

### Infrastructure Requirements

- **Node.js 20.10.0+**
- **PostgreSQL 15+**
- **Redis 7+**
- **Sui CLI**
- **Docker & Docker Compose**
- **Domain name with SSL certificate**

### Environment Setup

1. **Clone the repository:**
```bash
git clone https://github.com/No-Gas-Labs/sui-flash-loan-dapp.git
cd sui-flash-loan-dapp
```

2. **Install Node.js dependencies:**
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

3. **Install Sui CLI:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui
```

## Environment Configuration

### 1. Backend Environment

Create `backend/.env`:
```bash
# Sui Network Configuration
SUI_NETWORK=mainnet
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
SUI_RPC_BACKUP_1=https://sui-mainnet.nodeinfra.com
SUI_RPC_BACKUP_2=https://mainnet.sui.rpcpool.com
PACKAGE_ID=0x... # Your deployed package ID

# Server Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://username:password@your-db-host:5432/flashloan
REDIS_URL=redis://your-redis-host:6379

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key-256-bits
MAX_GAS_BUDGET=1000000
DEFAULT_GAS_BUDGET=500000

# Monitoring
LOG_LEVEL=info
ENABLE_AUDIT_LOGS=true
SENTRY_DSN=your-sentry-dsn
```

### 2. Frontend Environment

Create `frontend/.env.local`:
```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_SUI_NETWORK=mainnet
NEXT_PUBLIC_PACKAGE_ID=0x... # Your deployed package ID
```

## Smart Contract Deployment

### 1. Compile and Test Contracts

```bash
cd contracts

# Compile contracts
sui move build

# Run tests
sui move test

# Verify contracts
sui move verify
```

### 2. Deploy to Mainnet

```bash
# Initialize client
sui client init --mainnet

# Deploy contracts
sui client publish --gas-budget 10000000

# Note the package ID and update environment variables
```

### 3. Initialize Pool

```bash
# Create initial flash loan pool
sui client call \
  --package <PACKAGE_ID> \
  --module flash_loan \
  --function create_pool_entry \
  --args <INITIAL_DEPOSIT> <FEE_RATE> <MAX_LOAN_AMOUNT> \
  --gas-budget 5000000
```

## Database Setup

### 1. PostgreSQL Configuration

```sql
-- Create database
CREATE DATABASE flashloan;
CREATE USER flashloan_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE flashloan TO flashloan_user;

-- Create tables (handled by backend migrations)
```

### 2. Redis Configuration

```bash
# Start Redis with security configuration
redis-server --requirepass secure_redis_password
```

## Backend Deployment

### Option 1: Docker Deployment

1. **Create Dockerfile:**
```dockerfile
FROM node:20.10.0-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

2. **Create docker-compose.yml:**
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: flashloan
      POSTGRES_USER: flashloan_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass secure_redis_password
    restart: unless-stopped

volumes:
  postgres_data:
```

3. **Deploy:**
```bash
docker-compose up -d
```

### Option 2: Cloud Deployment (AWS)

1. **Create EC2 Instance:**
```bash
# Ubuntu 22.04 LTS, t3.medium or larger
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxxx \
  --subnet-id subnet-xxxxxxxxx \
  --user-data file://user-data.sh
```

2. **User Data Script (user-data.sh):**
```bash
#!/bin/bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose nodejs npm postgresql redis-server

# Clone and deploy
git clone https://github.com/No-Gas-Labs/sui-flash-loan-dapp.git
cd sui-flash-loan-dapp
docker-compose up -d
```

## Frontend Deployment

### Option 1: GitHub Pages (Recommended)

1. **Configure GitHub Pages:**
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: main, folder: /root

2. **Configure Custom Domain:**
   - Add CNAME record: `your-domain.com → 185.199.108.153`
   - Update repository settings with custom domain

3. **Enable HTTPS:**
   - GitHub Pages automatically provisions SSL certificates

### Option 2: Vercel Deployment

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Deploy:**
```bash
cd frontend
vercel --prod
```

### Option 3: CloudFront + S3

1. **Build and Upload:**
```bash
cd frontend
npm run build
aws s3 sync out/ s3://your-bucket --delete
```

2. **Configure CloudFront:**
   - Origin: S3 bucket
   - Custom domain with SSL certificate
   - Cache policies optimized for static assets

## SSL/TLS Configuration

### 1. Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d your-domain.com -d api.your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. Cloudflare SSL

1. **Configure DNS:** Point domain to Cloudflare
2. **SSL Mode:** Full (Strict)
3. **Edge Certificates:** Enable Always HTTPS
4. **HSTS:** Enable with appropriate max-age

## Monitoring Setup

### 1. Application Monitoring

**Sentry Integration:**
```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Configure project
sentry-cli projects new flash-loan-dapp
```

**Prometheus + Grafana:**
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'flash-loan-backend'
    static_configs:
      - targets: ['localhost:3001']
```

### 2. Infrastructure Monitoring

**AWS CloudWatch:**
- Custom metrics for application performance
- Alarms for error rates and response times
- Dashboard for operational visibility

**Uptime Monitoring:**
- Pingdom or UptimeRobot for external monitoring
- Health check endpoints: `/health` and `/health/detailed`
- Alerting via Slack/PagerDuty

## Load Balancer Configuration

### Nginx Configuration

```nginx
upstream backend {
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Security Hardening

### 1. Firewall Configuration

```bash
# UFW setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Security Headers

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## Performance Optimization

### 1. Backend Optimization

- **Connection Pooling:** Configure PostgreSQL connection pool
- **Redis Caching:** Implement proper cache invalidation
- **CDN:** Use CloudFront for API responses
- **Compression:** Enable gzip/brotli compression

### 2. Frontend Optimization

- **Code Splitting:** Implement dynamic imports
- **Image Optimization:** Use next/image with WebP
- **Font Optimization:** Use font-display: swap
- **Critical CSS:** Inline above-the-fold styles

## Backup Strategy

### 1. Database Backups

```bash
# Daily backups
pg_dump -h localhost -U flashloan_user flashloan | gzip > backup_$(date +%Y%m%d).sql.gz

# Upload to S3
aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://your-backup-bucket/
```

### 2. Configuration Backups

```bash
# Backup environment files and certificates
tar -czf config_backup_$(date +%Y%m%d).tar.gz .env* /etc/letsencrypt/
aws s3 cp config_backup_$(date +%Y%m%d).tar.gz s3://your-backup-bucket/
```

## Disaster Recovery

### 1. Recovery Procedures

**Database Recovery:**
```bash
# Restore from backup
gunzip -c backup_20231031.sql.gz | psql -h localhost -U flashloan_user flashloan
```

**Application Recovery:**
```bash
# Redeploy application
git pull origin main
docker-compose down
docker-compose up -d --build
```

### 2. Failover Testing

- Regular failover drills (monthly)
- Document RTO/RPO targets
- Test backup restoration procedures
- Validate monitoring and alerting

## Post-Deployment Checklist

### ✅ Security Verification

- [ ] SSL certificates valid and properly configured
- [ ] Security headers implemented
- [ ] Rate limiting configured and tested
- [ ] Audit logging enabled and functioning
- [ ] Vulnerability scans completed

### ✅ Performance Verification

- [ ] Load testing completed
- [ ] CDN properly configured
- [ ] Compression enabled
- [ ] Cache headers optimized
- [ ] Database queries optimized

### ✅ Monitoring Verification

- [ ] Health checks responding correctly
- [ ] Metrics collection working
- [ ] Alert rules configured
- [ ] Dashboard created
- [ ] Log aggregation functioning

### ✅ Functionality Verification

- [ ] Smart contracts deployed and verified
- [ ] API endpoints responding correctly
- [ ] Frontend loading properly
- [ ] Wallet connections working
- [ ] End-to-end transactions successful

## Ongoing Maintenance

### Daily Tasks

- Monitor application health and performance
- Review security logs for anomalies
- Check backup completion status
- Verify SSL certificate expiry dates

### Weekly Tasks

- Review and rotate secrets if needed
- Update dependencies and patches
- Analyze performance trends
- Conduct security scan reviews

### Monthly Tasks

- Perform disaster recovery drills
- Update documentation
- Review and optimize costs
- Conduct security assessments

## Support Contacts

- **Technical Support:** tech-support@your-domain.com
- **Security Issues:** security@your-domain.com
- **Emergency Contact:** +1-555-EMERGENCY

## Conclusion

Following this deployment guide will ensure a secure, performant, and resilient production deployment of the Sui Flash Loan DApp. Regular monitoring and maintenance are essential for maintaining the high availability and security standards expected of an enterprise-grade DeFi platform.