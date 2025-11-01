#!/bin/bash

# Monitoring Setup Script for Sui Flash Loan DApp

set -e

echo "📊 Setting up Monitoring & Alerting"
echo "===================================="

# Create monitoring directories
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/datasources

# Create Grafana datasource configuration
cat > monitoring/grafana/datasources/prometheus.yml <<EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Create Grafana dashboard configuration
cat > monitoring/grafana/dashboards/dashboard.yml <<EOF
apiVersion: 1

providers:
  - name: 'Sui Flash Loan'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

# Create main dashboard JSON
cat > monitoring/grafana/dashboards/flash-loan-dashboard.json <<EOF
{
  "dashboard": {
    "title": "Sui Flash Loan DApp",
    "tags": ["flash-loan", "sui", "defi"],
    "timezone": "browser",
    "panels": [
      {
        "title": "API Request Rate",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~&quot;5..&quot;}[5m])",
            "legendFormat": "5xx Errors"
          }
        ]
      },
      {
        "title": "Response Time (95th percentile)",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Flash Loan Transactions",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "rate(flash_loan_total[5m])",
            "legendFormat": "Total"
          },
          {
            "expr": "rate(flash_loan_success_total[5m])",
            "legendFormat": "Success"
          },
          {
            "expr": "rate(flash_loan_failed_total[5m])",
            "legendFormat": "Failed"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16},
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "title": "Redis Memory Usage",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 16},
        "targets": [
          {
            "expr": "redis_memory_used_bytes",
            "legendFormat": "Memory Used"
          }
        ]
      }
    ],
    "refresh": "10s",
    "time": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
EOF

echo "✅ Monitoring configuration created"

# Create alertmanager configuration
mkdir -p monitoring/alertmanager

cat > monitoring/alertmanager/config.yml <<EOF
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical'
    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:5001/webhook'
  
  - name: 'critical'
    slack_configs:
      - api_url: '\${SLACK_WEBHOOK_URL}'
        channel: '#alerts-critical'
        title: 'Critical Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    
  - name: 'warning'
    slack_configs:
      - api_url: '\${SLACK_WEBHOOK_URL}'
        channel: '#alerts-warning'
        title: 'Warning: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname']
EOF

echo "✅ Alertmanager configuration created"

# Create monitoring docker-compose override
cat > docker-compose.monitoring.yml <<EOF
version: '3.8'

services:
  alertmanager:
    image: prom/alertmanager:latest
    container_name: flashloan-alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager/config.yml:/etc/alertmanager/config.yml:ro
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/config.yml'
      - '--storage.path=/alertmanager'
    restart: unless-stopped
    networks:
      - flashloan-network

  node-exporter:
    image: prom/node-exporter:latest
    container_name: flashloan-node-exporter
    ports:
      - "9100:9100"
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    restart: unless-stopped
    networks:
      - flashloan-network

volumes:
  alertmanager_data:
    driver: local

networks:
  flashloan-network:
    external: true
EOF

echo "✅ Monitoring docker-compose override created"

echo ""
echo "===================================="
echo "✅ Monitoring Setup Complete!"
echo "===================================="
echo ""
echo "📊 Services configured:"
echo "   - Prometheus (metrics collection)"
echo "   - Grafana (visualization)"
echo "   - Alertmanager (alerting)"
echo "   - Node Exporter (system metrics)"
echo ""
echo "🚀 To start monitoring:"
echo "   docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d"
echo ""
echo "🌐 Access URLs:"
echo "   - Grafana: http://localhost:3002 (admin/admin)"
echo "   - Prometheus: http://localhost:9090"
echo "   - Alertmanager: http://localhost:9093"
echo ""
echo "📝 Next steps:"
echo "   1. Configure Slack webhook URL in alertmanager/config.yml"
echo "   2. Customize alert rules in monitoring/alerts.yml"
echo "   3. Import additional Grafana dashboards"
echo ""