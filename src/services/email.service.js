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

module.exports = { sendPasswordResetEmail };
