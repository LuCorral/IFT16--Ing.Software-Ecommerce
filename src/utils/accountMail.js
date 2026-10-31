const nodemailer = require('nodemailer');
function configured() {
  try {
    const url = new URL(process.env.PUBLIC_URL);
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM &&
      (url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:')));
  } catch { return false; }
}
async function sendReset(email, token) {
  const url = new URL('/login.html', process.env.PUBLIC_URL);
  url.hash = `reset=${token}`;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', requireTLS: process.env.SMTP_SECURE !== 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000, socketTimeout: 15000,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM, to: email,
    subject: 'Recuperá tu contraseña de Ecommerce',
    text: `Para crear una nueva contraseña, abrí este enlace: ${url}\nEl enlace vence en 20 minutos y se puede usar una sola vez. Si no lo solicitaste, ignorá este correo.`,
  });
}
module.exports = { configured, sendReset };
