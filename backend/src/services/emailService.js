const nodemailer = require('nodemailer');
const dns = require('dns');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const checkDnsResolution = (hostname) => {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, (err, address) => {
      if (err) {
        reject(new Error(`DNS resolution failed for host ${hostname}: ${err.message}`));
      } else {
        resolve(address);
      }
    });
  });
};

const connectEmail = async () => {
  const mailer = getTransporter();
  if (!mailer) {
    console.log('Nodemailer: SMTP_USER or SMTP_PASS missing. Email notifications disabled.');
    return;
  }

  if (process.env.VERCEL) {
    console.log('Nodemailer: Running in serverless context (Vercel). Skipping SMTP verification on startup.');
    return;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  try {
    console.log(`Checking DNS resolution for SMTP host: ${host}...`);
    await checkDnsResolution(host);
    console.log('DNS resolution: OK');

    console.log('Verifying SMTP transporter connection...');
    await mailer.verify();
    console.log('Nodemailer connected: OK');
  } catch (error) {
    console.error('Nodemailer connection failed:', error.message);
    console.warn('⚠️ SMTP credentials verification failed. Emails will not send.');
  }
};

const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
  const mailer = getTransporter();
  if (!mailer || !to) return false;

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || text,
      attachments,
    });
    return true;
  } catch (error) {
    console.error('Email send failed:', error.message);
    return false;
  }
};

/**
 * Sends a resolution notification email to the issue reporter.
 * Embeds any evidence photos as inline images in the email body.
 *
 * @param {Object} params
 * @param {string} params.reporterEmail - Recipient email address
 * @param {string} params.reporterName  - Reporter's display name
 * @param {Object} params.issue         - Mongoose Issue document (with populated fields)
 * @param {Object} params.asset         - Mongoose Asset document
 * @param {string} params.resolutionNote - The technician/admin note on resolution
 */
const sendResolutionEmail = async ({ reporterEmail, reporterName, issue, asset, resolutionNote }) => {
  if (!reporterEmail) return false;

  const evidencePhotos = Array.isArray(issue.evidence) ? issue.evidence : [];

  // Build evidence photo rows for the HTML body
  const evidenceHtml = evidencePhotos.length > 0
    ? `
      <tr>
        <td style="padding: 20px 24px 0;">
          <p style="margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;">Evidence Photos Submitted</p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${evidencePhotos.map((url, i) => `
              <a href="${url}" target="_blank" style="display: inline-block; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
                <img src="${url}" alt="Evidence ${i + 1}" width="120" height="120"
                  style="display: block; width: 120px; height: 120px; object-fit: cover;" />
              </a>
            `).join('')}
          </div>
        </td>
      </tr>`
    : '';

  const issueDate = issue.createdAt
    ? new Date(issue.createdAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
    : 'N/A';
  const resolvedDate = issue.resolvedAt
    ? new Date(issue.resolvedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
    : new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Issue Resolved – MaintainIQ</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.15em;">MaintainIQ</p>
              <h1 style="margin: 10px 0 0; font-size: 24px; font-weight: 800; color: #ffffff;">✅ Your Issue Has Been Resolved</h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 28px 24px 0;">
              <p style="margin: 0; font-size: 15px; color: #334155;">Hello <strong>${reporterName || 'there'}</strong>,</p>
              <p style="margin: 10px 0 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                Great news! The issue you reported has been reviewed and resolved by our maintenance team.
                Here is a summary of what was done.
              </p>
            </td>
          </tr>

          <!-- Issue Summary Card -->
          <tr>
            <td style="padding: 20px 24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Issue Reference</p>
                    <p style="margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #0f172a; font-family: monospace;">${issue.issueNumber}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Issue Title</p>
                    <p style="margin: 4px 0 0; font-size: 14px; font-weight: 600; color: #1e293b;">${issue.title}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Asset</p>
                    <p style="margin: 4px 0 0; font-size: 14px; color: #1e293b;">${asset ? `${asset.name} (${asset.code})` : issue.assetCode} ${asset && asset.location ? `— ${asset.location}` : ''}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Reported On</p>
                    <p style="margin: 4px 0 0; font-size: 14px; color: #1e293b;">${issueDate}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Resolved On</p>
                    <p style="margin: 4px 0 0; font-size: 14px; color: #1e293b;">${resolvedDate}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Resolution Note -->
          ${resolutionNote ? `
          <tr>
            <td style="padding: 20px 24px 0;">
              <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;">Resolution Note from Technician</p>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 18px;">
                <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.65;">${resolutionNote}</p>
              </div>
            </td>
          </tr>` : ''}

          <!-- AI Summary -->
          ${issue.aiMaintenanceSummary ? `
          <tr>
            <td style="padding: 20px 24px 0;">
              <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;">✨ AI Maintenance Summary</p>
              <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 16px 18px;">
                <p style="margin: 0; font-size: 14px; color: #6b21a8; line-height: 1.65;">${issue.aiMaintenanceSummary}</p>
              </div>
            </td>
          </tr>` : ''}

          <!-- AI Preventive Tip -->
          ${issue.aiPreventiveRecommendation ? `
          <tr>
            <td style="padding: 16px 24px 0;">
              <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;">💡 Preventive Recommendation</p>
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px 18px;">
                <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.65;">${issue.aiPreventiveRecommendation}</p>
              </div>
            </td>
          </tr>` : ''}

          <!-- Evidence Photos -->
          ${evidenceHtml}

          <!-- Footer Note -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
                If you believe the issue has not been fully resolved or you experience the problem again, please re-scan the asset QR code and submit a new report.<br/><br/>
                Thank you for using MaintainIQ to keep our facilities in top shape!
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="margin: 0; font-size: 11px; color: #cbd5e1; text-align: center;">
                MaintainIQ · Automated Facility Maintenance Platform
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textFallback = `Hello ${reporterName || 'there'},\n\nYour issue "${issue.title}" (${issue.issueNumber}) has been resolved.\n\nResolution note: ${resolutionNote || 'N/A'}\n\nThank you for using MaintainIQ.`;

  return sendEmail({
    to: reporterEmail,
    subject: `✅ Issue Resolved: ${issue.issueNumber} — MaintainIQ`,
    text: textFallback,
    html,
  });
};

module.exports = { sendEmail, connectEmail, sendResolutionEmail };

