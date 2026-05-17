# Logging Architecture

## Application Logs (ECS format)
Written to `logs/app.log` via Pino.
Fields include `trace.id` for W3C distributed tracing context.
Example:
```json
{"level":30,"time":1700000000000,"pid":123,"hostname":"local","trace.id":"abc123def456","message":"ai-service listening at http://127.0.0.1:3007"}
```

## Security Events (CEF format)
Written to `logs/security.cef.log`.
Events:
- `AUTH_SUCCESS`
- `AUTH_FAIL`
- `SQLI_DETECTED`
- `PROMPT_INJECTION`

Example:
```
CEF:0|VulnCMS|vuln-cms|1.0|AUTH_FAIL|Login Failure|5|username=admin ip=127.0.0.1
```

## Audit Logs (JSONL)
Written to `logs/audit.log`. Appended upon admin/critical actions.
Example:
```json
{"timestamp":"2023-01-01T00:00:00Z","actor":"system","action":"post_created","target":"1","before":null,"after":{"id":1},"ip":"127.0.0.1","ua":"Mozilla/5.0"}
```
