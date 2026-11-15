/**
 * Seed de dashboard contra un sitio productivo (o local) vía API.
 *
 * Variables de entorno:
 *   PROD_BASE_URL        URL base del sitio (ej. https://mi-dominio.com)
 *   PROD_ADMIN_EMAIL     Email de un administrador
 *   PROD_ADMIN_PASSWORD  Clave del administrador
 *   CLIENTS              (opcional) cantidad de clientes a crear (default 5)
 *   ORDERS_PER_CLIENT    (opcional) pedidos por cliente (default 4)
 *   CLIENT_PASSWORD      (opcional) clave para los clientes demo (default Dashboard2026!)
 *
 * Ejemplo:
 *   set PROD_BASE_URL=https://mi-sitio.com
 *   set PROD_ADMIN_EMAIL=admin@mi-sitio.com
 *   set PROD_ADMIN_PASSWORD=miClaveAdmin
 *   node scripts/seed-dashboard-prod.js
 */
const PASSWORD = process.env.CLIENT_PASSWORD || 'Dashboard2026!';
const BASE_URL = (process.env.PROD_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.PROD_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PROD_ADMIN_PASSWORD;
const CLIENT_COUNT = Number(process.env.CLIENTS || 8);
const ORDERS_PER_CLIENT = Number(process.env.ORDERS_PER_CLIENT || 5);

const CLIENTS = Array.from({ length: CLIENT_COUNT }, (_, i) => ({
  name: `Cliente${i + 1}`,
  apellido: 'Demo',
  email: `cliente.demo${i + 1}@demoecommerce.com`,
}));

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${path}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function login(email, password) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return data.token;
}

async function register(client) {
  try {
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: client.name, apellido: client.apellido, email: client.email, password: PASSWORD }),
    });
    return true;
  } catch (e) {
    if (e.status === 409) return false; // ya existía
    throw e;
  }
}

async function fetchProducts() {
  const products = [];
  let page = 1;
  while (true) {
    const data = await api(`/api/productos?limit=100&page=${page}`);
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    products.push(...items);
    if (!data?.pagination?.hasNextPage) break;
    page++;
  }
  return products;
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Faltan PROD_ADMIN_EMAIL / PROD_ADMIN_PASSWORD');
  }

  console.log(`Conectando a ${BASE_URL}...`);
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Admin autenticado.');

  const products = await fetchProducts();
  if (products.length === 0) throw new Error('No se encontraron productos en el catálogo');
  console.log(`Productos disponibles: ${products.length}`);

  const statesSummary = { Pendiente: 0, Pagado: 0, Enviado: 0, Entregado: 0, Cancelado: 0 };

  for (const client of CLIENTS) {
    await register(client);
    let token;
    try {
      token = await login(client.email, PASSWORD);
    } catch (e) {
      console.error(`No se pudo loguear ${client.email}: ${e.message}`);
      continue;
    }

    for (let o = 0; o < ORDERS_PER_CLIENT; o++) {
      // 1 o 2 productos por pedido
      const numItems = rnd(1, 2);
      const chosen = [...products].sort(() => Math.random() - 0.5).slice(0, numItems);
      const productos = [];
      for (const p of chosen) {
        const maxQty = Math.min(3, Math.max(1, p.stock || 1));
        productos.push({ productoId: p.id, cantidad: rnd(1, maxQty) });
      }

      let orderId;
      try {
        const created = await api('/api/pedidos', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ productos }),
        });
        orderId = created?.pedido?.id ?? created?.id;
      } catch (e) {
        console.error(`  Error creando pedido para ${client.email}: ${e.message}`);
        continue;
      }
      if (!orderId) continue;

      // Decidir destino del pedido
      const roll = Math.random();
      if (roll < 0.25) {
        // Cancelar
        try {
          await api(`/api/pedidos/${orderId}/cancelar`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
          statesSummary.Cancelado++;
        } catch { statesSummary.Pendiente++; }
      } else if (roll < 0.55) {
        // Pagar aprobado
        try {
          await api(`/api/pedidos/${orderId}/pagar`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ metodo: pick(['tarjeta', 'transferencia']), resultadoSimulado: 'aprobado' }),
          });
          statesSummary.Pagado++;
          // Avanzar algunos pagados a Enviado/Entregado (admin)
          if (Math.random() < 0.6) {
            const next = Math.random() < 0.5 ? 'Enviado' : 'Entregado';
            try {
              await api(`/api/pedidos/${orderId}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${adminToken}` },
                body: JSON.stringify({ estado: next }),
              });
              statesSummary.Pagado--;
              statesSummary[next]++;
            } catch { /* queda Pagado */ }
          }
        } catch { statesSummary.Pendiente++; }
      } else if (roll < 0.7) {
        // Pagar rechazado (queda Pendiente)
        try {
          await api(`/api/pedidos/${orderId}/pagar`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ metodo: 'tarjeta', resultadoSimulado: 'rechazado' }),
          });
        } catch { /* ignore */ }
        statesSummary.Pendiente++;
      } else {
        statesSummary.Pendiente++;
      }
    }
    console.log(`  ${client.email}: ${ORDERS_PER_CLIENT} pedidos procesados`);
  }

  console.log('\nResumen de estados generados:');
  console.table(statesSummary);
  console.log('\nClientes (clave común):', PASSWORD);
}

main().catch((e) => { console.error(e); process.exit(1); });