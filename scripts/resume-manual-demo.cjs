// Restart only a previously created disposable demo; preserve all database data.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const storage = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Puerto inválido');
const parent = path.dirname(storage);
if (path.dirname(parent).toLowerCase() !== path.resolve(os.tmpdir()).toLowerCase() || !/^ecommerce-manual-[a-z0-9]+$/i.test(path.basename(parent)) || path.basename(storage) !== 'demo.sqlite' || !fs.existsSync(storage)) throw new Error('Se requiere una base temporal ecommerce-manual-*/demo.sqlite existente');
Object.assign(process.env, { DB_STORAGE: storage, DB_DIALECT: 'sqlite', NODE_ENV: 'test', JWT_SECRET: crypto.randomBytes(48).toString('hex'), SMTP_HOST: '', ORDER_MAIL_MODE: 'demo', ORDER_MAIL_TO: '' });
const db = require('../src/config/database');
const { app } = require('../server');
let server;
(async () => {
  if (db.options.storage !== storage) throw new Error('Base inesperada');
  const account = await require('nodemailer').createTestAccount();
  Object.assign(process.env, { SMTP_HOST: account.smtp.host, SMTP_PORT: String(account.smtp.port), SMTP_SECURE: String(account.smtp.secure), SMTP_USER: account.user, SMTP_PASSWORD: account.pass, SMTP_FROM: account.user, ORDER_MAIL_TO: account.user });
  await db.authenticate();
  server = app.listen(port, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  process.env.PUBLIC_URL = `http://127.0.0.1:${server.address().port}`;
  console.log(JSON.stringify({ url: process.env.PUBLIC_URL, database: storage, smtp: 'Ethereal — cuenta temporal nueva, sin entrega real', preserved: 'Usuarios, claves y datos existentes; sin seeds ni migraciones' }));
})().catch(async (error) => { console.error('No se pudo reanudar la demo:', error.code || error.name); await db.close(); process.exitCode = 1; });
process.on('SIGINT', async () => { if (server) await new Promise((r) => server.close(r)); await db.close(); process.exit(0); });
