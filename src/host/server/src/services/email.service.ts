/**
 * @file email.service.ts
 * @description Email service for sending transactional messages
 * such as password reset tokens. Uses console logging in development,
 * and Nodemailer with SMTP in production.
 *
 * To enable real email sending, set NODE_ENV=production and define SMTP credentials:
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_USER
 * - SMTP_PASS
 * - SMTP_FROM (e.g., "Corev Support <support@corev.dev>")
 *
 * @license MIT
 */

import mustache from 'mustache';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { SendResetTokenOptions } from '@interfaces/email.interface';

const resetTemplatePath = path.resolve(__dirname, '../templates/reset-password.mustache');
const resetTemplate = fs.readFileSync(resetTemplatePath, 'utf-8');

/**
 * Sends a password reset token via email.
 * Uses mustache template for formatting the message.
 *
 * @param options - Contains recipient email, token and expiration timestamp
 * @returns true if the email was sent (or simulated successfully)
 */
export async function sendResetToken({
  email,
  token,
  expires,
}: SendResetTokenOptions): Promise<boolean> {
  const subject = 'Reset your Corev password';
  const text = mustache.render(resetTemplate, {
    token,
    expires: expires.toISOString(),
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`📧 [DEV] Sending password reset token to: ${email}`);
    console.log(text);
    return true;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@corev.dev',
    to: email,
    subject,
    text,
  });

  return true;
}
