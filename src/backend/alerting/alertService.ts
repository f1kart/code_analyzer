import nodemailer from 'nodemailer';
import config from '../config.js';
import logger from '../logger.js';

const severityRank: Record<string, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

let emailTransport: nodemailer.Transporter | null = null;

const ensureEmailTransport = (): nodemailer.Transporter | null => {
  if (!config.alerting.emailSmtpUrl) {
    return null;
  }
  if (emailTransport) {
    return emailTransport;
  }
  try {
    emailTransport = nodemailer.createTransport(config.alerting.emailSmtpUrl);
    return emailTransport;
  } catch (error) {
    logger.error({ error }, '[Alerting] Failed to create email transport');
    return null;
  }
};

const shouldNotify = (severity: string): boolean => {
  const normalized = severity.toLowerCase();
  const minSeverityRank = severityRank[config.alerting.minSeverity] ?? severityRank.warning;
  const currentRank = severityRank[normalized] ?? severityRank.warning;
  return currentRank >= minSeverityRank;
};

const sendSlackNotification = async (message: string): Promise<void> => {
  if (!config.alerting.slackWebhook) {
    return;
  }

  try {
    const response = await fetch(config.alerting.slackWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, statusText: response.statusText }, '[Alerting] Slack notification failed');
    }
  } catch (error) {
    logger.error({ error }, '[Alerting] Error sending Slack notification');
  }
};

const sendEmailNotification = async (subject: string, message: string): Promise<void> => {
  if (config.alerting.emailRecipients.length === 0) {
    return;
  }

  const transport = ensureEmailTransport();
  if (!transport) {
    logger.warn('[Alerting] Email transport not configured; skipping email alert');
    return;
  }

  try {
    await transport.sendMail({
      from: config.alerting.emailFrom ?? 'alerts@gemini-ide.local',
      to: config.alerting.emailRecipients.join(','),
      subject,
      text: message,
    });
  } catch (error) {
    logger.error({ error }, '[Alerting] Error sending email notification');
  }
};

export interface TelemetryAlertPayload {
  eventType: string;
  severity: string;
  occurredAt: Date;
  projectId?: string | null;
  projectName?: string | null;
  correlationId?: string | null;
  payload: Record<string, unknown>;
}

export const sendTelemetryAlert = async (payload: TelemetryAlertPayload): Promise<void> => {
  if (!shouldNotify(payload.severity)) {
    return;
  }

  const formatted = `Telemetry alert\nSeverity: ${payload.severity}\nEvent: ${payload.eventType}\nProject: ${payload.projectName ?? payload.projectId ?? 'N/A'}\nOccurred At: ${payload.occurredAt.toISOString()}\nCorrelation: ${payload.correlationId ?? 'N/A'}\nPayload: ${JSON.stringify(payload.payload, null, 2)}`;

  await Promise.all([
    sendSlackNotification(formatted),
    sendEmailNotification(`Telemetry ${payload.severity.toUpperCase()}: ${payload.eventType}`, formatted),
  ]);
};

export const resetAlertingTransports = (): void => {
  emailTransport = null;
};
