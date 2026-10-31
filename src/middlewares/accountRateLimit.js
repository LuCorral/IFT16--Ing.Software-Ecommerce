// Bound memory and limit recovery requests per direct client address.
const buckets = new Map();
module.exports = (req, res, next) => {
  const now = Date.now();
  for (const [key, value] of buckets) if (value.expires <= now) buckets.delete(key);
  const key = `${req.path}:${req.ip}`;
  if (!buckets.has(key)) {
    if (buckets.size >= 10000) return res.status(429).json({ message: 'Intentá nuevamente en unos minutos' });
    buckets.set(key, { count: 0, expires: now + 15 * 60 * 1000 });
  }
  const entry = buckets.get(key);
  if (++entry.count > 10) {
    res.set('Retry-After', String(Math.ceil((entry.expires - now) / 1000)));
    return res.status(429).json({ message: 'Demasiados intentos. Intentá nuevamente en unos minutos.' });
  }
  next();
};
