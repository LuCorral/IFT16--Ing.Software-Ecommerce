const path = require('node:path');

const applicationRoot = path.resolve(__dirname, '../..');

function isWithinDirectory(directory, target) {
  const relativePath = path.relative(directory, target);
  return relativePath === ''
    || (relativePath !== '..'
      && !relativePath.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relativePath));
}

function validateEnvironment(environment = process.env) {
  const secret = typeof environment.JWT_SECRET === 'string'
    ? environment.JWT_SECRET.trim()
    : '';
  if (secret.length < 32 || secret.startsWith('replace-with-') || secret.startsWith('<')) {
    throw new Error('JWT_SECRET must be set to a random value with at least 32 characters.');
  }

  const isProduction = environment.NODE_ENV === 'production';
  const configuredStorage = environment.DB_STORAGE || './ecommerce.sqlite';
  const storagePath = path.resolve(applicationRoot, configuredStorage);
  if (isProduction) {
    if (!environment.DB_STORAGE || !path.isAbsolute(environment.DB_STORAGE)) {
      throw new Error('Production requires DB_STORAGE to be an absolute persistent path.');
    }
    if (isWithinDirectory(applicationRoot, storagePath)) {
      throw new Error('Production DB_STORAGE must be outside the deployed application directory.');
    }
    if (!environment.IP && !environment.HOST) {
      throw new Error('Production requires the host address supplied by the hosting provider (IP or HOST).');
    }
    if (!environment.PORT) {
      throw new Error('Production requires the PORT supplied by the hosting provider.');
    }
  }

  const port = Number(environment.PORT || 3000);
  if (!Number.isInteger(port) || port < (environment.NODE_ENV === 'test' ? 0 : 1) || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return {
    host: environment.IP || environment.HOST || '127.0.0.1',
    port,
    storagePath,
  };
}

module.exports = { validateEnvironment };
