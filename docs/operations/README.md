# StableNet Operations Guide

> **Version**: 1.0.0
> **Last Updated**: 2026-01-27

## Overview

이 문서는 StableNet 인프라의 운영 및 모니터링 가이드입니다.

---

## Service Health Monitoring

### Health Check Endpoints

모든 서비스는 `/health` 엔드포인트를 제공합니다:

| Service | URL | Expected Response |
|---------|-----|-------------------|
| Bundler | `http://localhost:3000/health` | `{"status":"ok"}` |
| Paymaster | `http://localhost:3001/health` | `{"status":"ok"}` |
| Subscription | `http://localhost:3002/health` | `{"status":"ok","database":"connected"}` |
| Bridge | `http://localhost:3003/health` | `{"status":"ok","isPaused":false}` |

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

SERVICES=(
  "bundler:3000"
  "paymaster-proxy:3001"
  "subscription-executor:3002"
  "bridge-relayer:3003"
)

for service in "${SERVICES[@]}"; do
  name="${service%%:*}"
  port="${service##*:}"

  response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health")

  if [ "$response" = "200" ]; then
    echo "✅ $name: healthy"
  else
    echo "❌ $name: unhealthy (HTTP $response)"
  fi
done
```

---

## Logging

### Log Format

모든 서비스는 JSON 형식의 구조화된 로그를 출력합니다:

```json
{
  "level": "info",
  "ts": "2026-01-27T12:00:00.000Z",
  "service": "bundler",
  "msg": "UserOperation submitted",
  "userOpHash": "0x...",
  "sender": "0x...",
  "requestId": "req_123"
}
```

### Log Levels

| Level | Description | When to Use |
|-------|-------------|-------------|
| `debug` | Detailed debugging | Development only |
| `info` | Normal operations | Default level |
| `warn` | Warning conditions | Potential issues |
| `error` | Error conditions | Failures |

### Log Aggregation (ELK Stack)

```yaml
# filebeat.yml
filebeat.inputs:
- type: container
  paths:
    - '/var/lib/docker/containers/*/*.log'
  processors:
    - add_docker_metadata:
        host: "unix:///var/run/docker.sock"
    - decode_json_fields:
        fields: ["message"]
        target: ""
        overwrite_keys: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "stablenet-logs-%{+yyyy.MM.dd}"
```

### Log Queries (Kibana)

```
# Failed UserOperations
service:bundler AND level:error AND msg:"UserOperation failed"

# High latency requests
service:* AND latency:>1000

# Specific user
sender:"0x1234..." AND service:bundler
```

---

## Metrics & Monitoring

### Prometheus Metrics

서비스 메트릭 엔드포인트: `/metrics`

**주요 메트릭:**

```prometheus
# Bundler
bundler_user_operations_total{status="success|failed"}
bundler_bundle_size_histogram
bundler_gas_price_gwei
bundler_mempool_size

# Paymaster
paymaster_sponsorship_total{status="approved|rejected"}
paymaster_gas_sponsored_wei
paymaster_daily_usage_usd

# Subscription
subscription_executions_total{status="success|failed"}
subscription_active_count
subscription_next_execution_seconds
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'stablenet'
    static_configs:
      - targets:
        - 'bundler:3000'
        - 'paymaster-proxy:3001'
        - 'subscription-executor:3002'
        - 'bridge-relayer:3003'
    metrics_path: '/metrics'
```

### Grafana Dashboards

#### Bundler Dashboard

```json
{
  "title": "Bundler Overview",
  "panels": [
    {
      "title": "UserOperations/min",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(bundler_user_operations_total[1m])",
          "legendFormat": "{{status}}"
        }
      ]
    },
    {
      "title": "Bundle Success Rate",
      "type": "gauge",
      "targets": [
        {
          "expr": "sum(rate(bundler_user_operations_total{status='success'}[5m])) / sum(rate(bundler_user_operations_total[5m])) * 100"
        }
      ]
    },
    {
      "title": "Mempool Size",
      "type": "stat",
      "targets": [
        {
          "expr": "bundler_mempool_size"
        }
      ]
    }
  ]
}
```

---

## Alerting

### Alert Rules

```yaml
# alertmanager-rules.yml
groups:
- name: stablenet
  rules:
  # Service Down
  - alert: ServiceDown
    expr: up{job="stablenet"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Service {{ $labels.instance }} is down"

  # High Error Rate
  - alert: HighErrorRate
    expr: |
      sum(rate(http_requests_total{status=~"5.."}[5m]))
      / sum(rate(http_requests_total[5m])) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Error rate above 5%"

  # Bundler Wallet Low Balance
  - alert: BundlerLowBalance
    expr: bundler_wallet_balance_wei < 100000000000000000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Bundler wallet balance below 0.1 ETH"

  # High Mempool
  - alert: HighMempoolSize
    expr: bundler_mempool_size > 100
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Mempool size above 100"

  # Paymaster Daily Limit
  - alert: PaymasterDailyLimitReached
    expr: paymaster_daily_usage_usd / paymaster_daily_limit_usd > 0.9
    for: 0m
    labels:
      severity: warning
    annotations:
      summary: "Paymaster daily limit 90% reached"
```

### AlertManager Configuration

```yaml
# alertmanager.yml
route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'slack-notifications'
  routes:
  - match:
      severity: critical
    receiver: 'pagerduty'

receivers:
- name: 'slack-notifications'
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/xxx'
    channel: '#stablenet-alerts'

- name: 'pagerduty'
  pagerduty_configs:
  - service_key: 'xxx'
```

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| P1 | Critical | 15 min | Service down, security breach |
| P2 | High | 1 hour | Degraded performance, partial outage |
| P3 | Medium | 4 hours | Non-critical feature failure |
| P4 | Low | 24 hours | Minor issues, cosmetic bugs |

### Runbooks

#### Bundler Service Down

```markdown
## Symptoms
- Health check failing
- No UserOperations being processed
- Error: "Connection refused"

## Diagnosis
1. Check service status: `docker compose ps bundler`
2. Check logs: `docker compose logs --tail=100 bundler`
3. Check RPC connection: `curl -X POST $RPC_URL -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}'`

## Resolution
1. If container crashed:
   - `docker compose restart bundler`
2. If RPC issue:
   - Switch to backup RPC
   - Update .env and restart
3. If out of memory:
   - Scale up resources
   - Check for memory leaks

## Escalation
- If unresolved in 15 min, page on-call engineer
```

#### High Gas Prices

```markdown
## Symptoms
- UserOperations failing with "insufficient funds"
- Gas estimates very high

## Diagnosis
1. Check current gas price: `cast gas-price --rpc-url $RPC_URL`
2. Check bundler balance: `cast balance $BUNDLER_ADDRESS`

## Resolution
1. If temporary spike:
   - Wait for gas to normalize
   - Adjust maxFeePerGas settings
2. If bundler low on funds:
   - Top up bundler wallet
   - Alert finance team

## Prevention
- Set up gas price alerts
- Maintain minimum bundler balance
```

---

## Backup & Recovery

### Database Backup

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups

# PostgreSQL backup
pg_dump -h postgres -U stablenet_user -d stablenet \
  | gzip > "$BACKUP_DIR/stablenet_$DATE.sql.gz"

# Upload to S3
aws s3 cp "$BACKUP_DIR/stablenet_$DATE.sql.gz" \
  s3://stablenet-backups/postgres/

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
```

### Backup Schedule (Cron)

```bash
# /etc/cron.d/stablenet-backup
0 */6 * * * root /opt/stablenet/backup.sh >> /var/log/backup.log 2>&1
```

### Recovery Procedure

```bash
# Download backup
aws s3 cp s3://stablenet-backups/postgres/stablenet_20260127.sql.gz ./

# Stop services
docker compose stop subscription-executor bridge-relayer

# Restore
gunzip -c stablenet_20260127.sql.gz | psql -h postgres -U stablenet_user -d stablenet

# Start services
docker compose start subscription-executor bridge-relayer

# Verify
curl http://localhost:3002/health
```

---

## Scaling

### Horizontal Scaling

```bash
# Scale bundler replicas
docker compose up -d --scale bundler=3

# Kubernetes
kubectl scale deployment bundler --replicas=5
```

### Load Balancing Configuration

```nginx
# nginx.conf
upstream bundler_cluster {
    least_conn;
    server bundler1:3000 weight=5;
    server bundler2:3000 weight=5;
    server bundler3:3000 weight=5;
    keepalive 32;
}

server {
    location /rpc {
        proxy_pass http://bundler_cluster;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }
}
```

### Auto-scaling (Kubernetes HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: bundler-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: bundler
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Maintenance Windows

### Planned Maintenance

1. **Announce** maintenance window 24 hours in advance
2. **Scale down** non-critical services
3. **Perform** updates/maintenance
4. **Verify** health checks
5. **Scale up** and monitor

### Zero-downtime Deployment

```bash
# Rolling update
kubectl set image deployment/bundler bundler=stablenet/bundler:v1.2.0

# Monitor rollout
kubectl rollout status deployment/bundler

# Rollback if needed
kubectl rollout undo deployment/bundler
```

---

## Security Operations

### Key Rotation

```bash
#!/bin/bash
# rotate-keys.sh

# Generate new key
NEW_KEY=$(openssl rand -hex 32)

# Update in secrets manager
aws secretsmanager update-secret \
  --secret-id stablenet/paymaster-signer \
  --secret-string "$NEW_KEY"

# Restart service to pick up new key
kubectl rollout restart deployment/paymaster-proxy
```

### Audit Logging

```sql
-- Enable audit logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
SELECT pg_reload_conf();
```

### Security Scanning

```bash
# Container vulnerability scan
trivy image stablenet/bundler:latest

# Dependency audit
pnpm audit

# Secret scanning
gitleaks detect --source . --verbose
```

---

## Troubleshooting

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| RPC timeout | Slow responses, timeouts | Check RPC provider status, switch to backup |
| Memory leak | Increasing memory usage | Restart service, investigate with profiler |
| DB connection pool exhausted | "too many connections" | Increase pool size, check for leaks |
| Gas estimation failure | AA21 errors | Check account has funds, paymaster active |

### Debug Commands

```bash
# Check service logs
docker compose logs --tail=1000 bundler | grep -i error

# Check database connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='stablenet'"

# Check mempool
curl http://localhost:3000/debug/mempool | jq

# Trace UserOperation
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"debug_traceUserOperation","params":["0x..."],"id":1}'
```

---

## Contacts

| Role | Name | Contact |
|------|------|---------|
| On-call Engineer | - | PagerDuty |
| DevOps Lead | - | Slack #devops |
| Security Team | - | security@stablenet.io |

---

## Related Documentation

- [Deployment Guide](../deployment/README.md)
- [Service API Reference](../services/README.md)
- [Incident Postmortems](./postmortems/)
