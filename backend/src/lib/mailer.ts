/** Email delivery via the Resend HTTP API (no SDK — plain fetch). */

import { isProduction } from './config.js'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
/** Resend's shared sender — works without a verified domain, but only
 *  delivers to the Resend account owner's own address. */
const DEFAULT_FROM = 'Tallyo <onboarding@resend.dev>'

export function isMailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim()

  if (!apiKey) {
    if (isProduction) {
      throw new Error('RESEND_API_KEY nie jest ustawiony — nie można wysłać maila resetującego')
    }
    // Local development without an API key: print the link instead of sending.
    console.log(`[mailer] Link resetu hasła dla ${to}: ${resetUrl}`)
    return
  }

  const from = process.env.MAIL_FROM?.trim() || DEFAULT_FROM
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Tallyo — reset hasła',
      text: [
        'Ktoś (mamy nadzieję, że Ty) poprosił o reset hasła do Tallyo.',
        '',
        `Ustaw nowe hasło klikając w link (ważny przez 1 godzinę):`,
        resetUrl,
        '',
        'Jeśli to nie Ty — zignoruj tę wiadomość, hasło pozostaje bez zmian.',
      ].join('\n'),
      html: [
        '<p>Ktoś (mamy nadzieję, że Ty) poprosił o reset hasła do <strong>Tallyo</strong>.</p>',
        `<p><a href="${resetUrl}">Ustaw nowe hasło</a> — link jest ważny przez 1 godzinę.</p>`,
        '<p>Jeśli to nie Ty — zignoruj tę wiadomość, hasło pozostaje bez zmian.</p>',
      ].join('\n'),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Resend API error ${response.status}: ${body}`)
  }
}
