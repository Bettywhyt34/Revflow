// ── Branded HTML email for notification events ────────────────────────────────

interface NotificationEmailParams {
  orgName: string
  orgLogoUrl: string | null
  primaryColor: string
  title: string
  message: string
  actionUrl: string | null
  actionLabel?: string
}

export function buildNotificationEmailHtml(params: NotificationEmailParams): string {
  const {
    orgName,
    orgLogoUrl,
    primaryColor,
    title,
    message,
    actionUrl,
    actionLabel = 'View Campaign',
  } = params

  const logoBlock = orgLogoUrl
    ? `<img src="${orgLogoUrl}" alt="${orgName}" style="height:40px;max-width:160px;object-fit:contain;display:block;" />`
    : `<div style="display:inline-block;background:${primaryColor};color:#fff;font-size:18px;font-weight:700;padding:8px 14px;border-radius:8px;">${orgName.charAt(0).toUpperCase()}</div>`

  const ctaBlock = actionUrl
    ? `
    <div style="text-align:center;margin:32px 0;">
      <a href="${actionUrl}" style="display:inline-block;background:${primaryColor};color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
        ${actionLabel}
      </a>
    </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

          <!-- Header -->
          <tr>
            <td style="background:${primaryColor};padding:20px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>${logoBlock}</td>
                  <td align="right" style="color:rgba(255,255,255,0.85);font-size:12px;font-weight:500;">
                    ${orgName}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;">
              <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;line-height:1.4;">
                ${title}
              </h2>
              <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">
                ${message}
              </p>
              ${ctaBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 28px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
                You are receiving this because you are assigned to this campaign on ${orgName} via Revflow.
                <br/>To manage your notification preferences, visit <strong>Settings → Notifications</strong>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
