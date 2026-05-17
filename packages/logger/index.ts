import pino from 'pino';
import ecsFormat from '@elastic/ecs-pino-format';
import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Application Logger (ECS Format)
export const logger = pino({
  ...ecsFormat(),
  level: process.env.LOG_LEVEL || 'info',
}, pino.multistream([
  { stream: process.stdout },
  { stream: pino.destination(path.join(logDir, 'app.log')) }
]));

// Security Logger (CEF Format)
const securityLogStream = fs.createWriteStream(path.join(logDir, 'security.cef.log'), { flags: 'a' });

export function logSecurityEvent(
  signatureId: string,
  name: string,
  severity: number,
  extension: Record<string, any>
) {
  // CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extension
  const extString = Object.entries(extension).map(([k, v]) => `${k}=${v}`).join(' ');
  const cefString = `CEF:0|VulnCMS|vuln-cms|1.0|${signatureId}|${name}|${severity}|${extString}\n`;
  securityLogStream.write(cefString);
}

// Audit Logger
const auditLogStream = fs.createWriteStream(path.join(logDir, 'audit.log'), { flags: 'a' });

export function logAudit(
  actor: string,
  action: string,
  target: string,
  before: any,
  after: any,
  ip: string,
  ua: string
) {
  const auditEvent = {
    timestamp: new Date().toISOString(),
    actor,
    action,
    target,
    before,
    after,
    ip,
    ua
  };
  auditLogStream.write(JSON.stringify(auditEvent) + '\n');
}
