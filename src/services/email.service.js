const nodemailer = require('nodemailer');

/**
 * Crea el transporter de nodemailer a partir de variables de entorno.
 * Si no hay SMTP configurado, usa ethereal (solo dev/testing).
 */
function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // En desarrollo se imprime un aviso; no lanza error para no romper el arranque
    console.warn(
      '[email.service] Variables SMTP no configuradas. Los correos NO se enviarán.'
    );
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const transporter = createTransporter();

/**
 * Envía un correo de recuperación de contraseña.
 * @param {string} to      - Destinatario
 * @param {string} resetUrl - URL completa para resetear contraseña
 */
async function sendPasswordResetEmail(to, resetUrl) {
  if (!transporter) {
    console.warn(
      `[email.service] Email de reset para ${to} NO enviado (SMTP no configurado).`
    );
    console.warn(`[email.service] Reset URL: ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@vayo.cl',
    to,
    subject: 'Recuperación de contraseña – VAYO Solutions',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #1F497D;">VAYO Solutions</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente botón para continuar:</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 24px;background:#1F497D;
                  color:#fff;text-decoration:none;border-radius:4px;margin:16px 0;">
          Restablecer contraseña
        </a>
        <p style="color:#666;font-size:13px;">
          Este enlace expira en 1 hora.<br>
          Si no solicitaste este cambio, ignora este correo.
        </p>
      </div>
    `,
  });
}

/**
 * Envía una cotización por correo, con el PDF adjunto.
 * @param {object} opts
 * @param {string} opts.to          email destino
 * @param {string} opts.folio       folio de la cotización (ej. Q-2026-0001)
 * @param {string} opts.clientName  nombre del cliente (para el saludo)
 * @param {Buffer} opts.pdfBuffer   PDF generado de la cotización
 * @param {number} [opts.total]     total para mostrar en el cuerpo
 */
async function sendQuoteEmail({ to, folio, clientName, pdfBuffer, total }) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[email.service] (simulado) Cotización ${folio} para ${to}`);
    return { simulated: true };
  }

  const from = process.env.SMTP_FROM || 'noreply@vayo.cl';
  const totalTxt =
    typeof total === 'number'
      ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(total)
      : '';

  await transport.sendMail({
    from,
    to,
    subject: `Tu cotización ${folio} - VAYO Solutions`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1a1a1a;">
        <h2 style="color: #0c447c;">VAYO Solutions</h2>
        <p>Hola${clientName ? ' ' + clientName : ''},</p>
        <p>Adjuntamos tu cotización <strong>${folio}</strong>.</p>
        ${totalTxt ? `<p>Total: <strong>${totalTxt}</strong></p>` : ''}
        <p>El documento PDF se encuentra adjunto a este correo. Si tienes
        preguntas, responde directamente a este mensaje.</p>
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          Gracias por preferir VAYO Solutions.
        </p>
      </div>
    `,
    attachments: pdfBuffer
      ? [{ filename: `${folio}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      : [],
  });

  return { sent: true };
}

module.exports = { sendPasswordResetEmail, sendQuoteEmail };
