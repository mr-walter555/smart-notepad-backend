const { Resend } = require('resend')

function getClient() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

async function sendInviteEmail({ to, inviteUrl, noteTitle, permissions }) {
  const resend = getClient()
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping email. Invite URL:', inviteUrl)
    return { skipped: true, inviteUrl }
  }

  const from = process.env.RESEND_FROM || 'Smart Notepad <onboarding@resend.dev>'

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `You've been invited to collaborate on "${noteTitle || 'a note'}"`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111827">
        <div style="margin-bottom:24px">
          <span style="background:#b05c18;color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;letter-spacing:.05em;text-transform:uppercase">Smart Notepad</span>
        </div>
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700">You've been invited to collaborate</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:15px">
          You have <strong style="color:#111827">${permissions}</strong> access to
          <em style="color:#111827">${noteTitle || 'a shared note'}</em>.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;background:#b05c18;color:#fff;padding:13px 28px;border-radius:9px;text-decoration:none;font-weight:600;font-size:15px">
          Open note →
        </a>
        <p style="margin-top:32px;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px">
          This invite link expires in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>
      </div>
    `,
  })

  if (error) throw new Error(error.message)
  return { sent: true, id: data?.id }
}

module.exports = { sendInviteEmail }
