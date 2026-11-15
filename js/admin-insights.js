(() => {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  const api = async (path, method = 'GET') => {
    const response = await fetch(`/api/${path}`, { method, headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo completar la consulta');
    return data;
  };
  let metricsVersion = 0, mailVersion = 0, mailPage = 1;
  window.loadMetrics = async () => {
    const version = ++metricsVersion;
    const output = document.getElementById('metrics-result');
    const period = document.getElementById('metrics-period');
    output.setAttribute('aria-busy', 'true');
    output.innerHTML = `<p class="metrics-loading-label" role="status">Calculando métricas…</p><div class="metrics-kpis" aria-hidden="true">${Array.from({ length: 4 }, () => '<div class="metrics-kpi"><span class="metrics-skeleton metrics-skeleton-label"></span><span class="metrics-skeleton"></span></div>').join('')}</div>`;
    try {
      const data = await api(`metricas?month=${encodeURIComponent(document.getElementById('metrics-month').value)}&year=${encodeURIComponent(document.getElementById('metrics-year').value)}`);
      if (version !== metricsVersion) return;
      const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(data.period.year, data.period.month - 1, 1)));
      const periodName = `${monthName[0].toUpperCase()}${monthName.slice(1)} ${data.period.year}`;
      period.textContent = periodName;
      const states = [['Pendiente', 'pending'], ['Pagado', 'paid'], ['Enviado', 'shipped'], ['Entregado', 'delivered'], ['Cancelado', 'cancelled']];
      const step = Math.max(1, Math.ceil(Math.max(...states.map(([name]) => Number(data.byStatus[name] || 0))) / 4));
      const maximum = step * 4;
      const kpis = [
        ['Ventas del período', money(data.totalSales), 'coins', 'Pedidos con pago aprobado; incluye el total de los pagos mixtos.'],
        ['Total de pedidos', Number(data.totalOrders), 'bag-shopping', ''],
        ['Ticket promedio', money(data.averageTicket), 'receipt', ''],
        ['Pedidos con pago aprobado', Number(data.paidOrders), 'circle-check', ''],
      ];
      output.innerHTML = `${Number(data.totalOrders) === 0 ? `<div class="metrics-feedback" role="status"><h3>Sin pedidos en este período</h3><p>No hay pedidos registrados en ${escape(periodName)}. Los indicadores del período se muestran en cero; el inventario refleja el stock actual.</p></div>` : ''}
        <dl class="metrics-kpis">${kpis.map(([title, value, icon, note]) => `<div class="metrics-kpi"><div class="metrics-kpi-heading"><dt>${title}</dt><span class="metrics-kpi-icon" aria-hidden="true"><i class="fa-solid fa-${icon}"></i></span></div><dd>${value}</dd>${note ? `<p class="metrics-sales-note">${note}</p>` : ''}</div>`).join('')}</dl>
        <div class="metrics-layout">
          <section class="metrics-panel" aria-labelledby="metrics-chart-title"><h3 id="metrics-chart-title">Pedidos por estado</h3><p class="metrics-panel-copy">Cantidad de pedidos de ${escape(periodName)}.</p>
            <ul class="metrics-chart">${states.map(([name, color]) => { const count = Number(data.byStatus[name] || 0); return `<li class="metrics-chart-row"><span>${name}</span><span class="metrics-bar-track" aria-hidden="true"><span class="metrics-bar metrics-state-${color}" style="width:${count / maximum * 100}%"></span></span><span class="metrics-chart-count">${count}</span></li>`; }).join('')}</ul>
            <div class="metrics-axis" aria-hidden="true"><span></span><div class="metrics-ticks">${Array.from({ length: 5 }, (_, i) => `<span>${i * step}</span>`).join('')}</div><span></span></div><p class="metrics-axis-label">Cantidad de pedidos</p>
          </section>
          <section class="metrics-panel" aria-labelledby="metrics-inventory-title"><h3 id="metrics-inventory-title">Inventario actual</h3><p class="metrics-panel-copy">Estos valores no dependen del período seleccionado.</p><div class="metrics-inventory">
            <button type="button" class="metrics-stock metrics-stock-low" data-inventory-filter="low" aria-label="Ver productos con stock bajo: ${Number(data.lowStock)} productos"><span><span class="metrics-stock-title"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Stock bajo</span><span class="metrics-stock-description">Productos con 1 a ${Number(data.lowStockThreshold)} unidades</span><span class="metrics-stock-action">Ver productos <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></span><strong>${Number(data.lowStock)}</strong></button>
            <button type="button" class="metrics-stock metrics-stock-empty" data-inventory-filter="empty" aria-label="Ver productos sin stock: ${Number(data.outOfStock)} productos"><span><span class="metrics-stock-title"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Sin stock</span><span class="metrics-stock-description">Productos con 0 unidades</span><span class="metrics-stock-action">Ver productos <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></span><strong>${Number(data.outOfStock)}</strong></button>
          </div></section>
        </div>
        <details class="metrics-help"><summary>Cómo se calculan estas métricas</summary><p>El período incluye los pedidos creados durante el mes calendario seleccionado en Argentina (Buenos Aires): desde el inicio del primer día hasta el inicio del mes siguiente, sin incluir este último.</p><p>Ventas, ticket promedio y pedidos con pago aprobado consideran estados Pagado, Enviado y Entregado con una aprobación de pago registrada. Cada pedido mixto cuenta una sola vez por su total. El ticket promedio es ventas dividido por esos pedidos. Pendientes y cancelados se incluyen en el total y en el gráfico, pero no en ventas.</p><p>El inventario cuenta productos, no unidades. Stock bajo corresponde a 1 a ${Number(data.lowStockThreshold)} unidades; sin stock corresponde a 0. La demo incluye aprobaciones de pago simuladas.</p></details>`;
      output.querySelectorAll('[data-inventory-filter]').forEach((button) => { button.onclick = () => window.openInventoryProducts(button.dataset.inventoryFilter); });
    } catch (error) {
      if (version === metricsVersion) {
        period.textContent = 'Consulta no disponible';
        output.innerHTML = `<div class="metrics-feedback metrics-error" role="alert"><h3>No pudimos cargar las métricas</h3><p>${escape(error.message)}</p><button type="button" class="btn-filter-primary" id="metrics-retry">Reintentar</button></div>`;
        document.getElementById('metrics-retry').onclick = () => window.loadMetrics();
      }
    } finally { if (version === metricsVersion) output.setAttribute('aria-busy', 'false'); }
  };
  const labels = { legado: 'Registro histórico simulado (sin envío)', en_cola: 'En cola', enviando: 'En proceso: revisar antes de reenviar', fallo: 'Fallo confirmado', incierto: 'Resultado incierto: requiere revisión', demo: 'Capturado en Ethereal (sin entrega real)', enviado: 'Aceptado por SMTP' };
  window.loadOrderMail = async (page = 1) => {
    const version = ++mailVersion; mailPage = page;
    const output = document.getElementById('mail-result'); output.textContent = 'Consultando correos…';
    try {
      const data = await api(`notificaciones-correo?page=${page}`);
      if (version !== mailVersion) return;
      output.innerHTML = data.items.length ? `<div class="admin-table-container"><table class="admin-table"><thead><tr><th>Pedido / fecha</th><th>Estado / intentos</th><th>Contenido</th><th>Acciones</th></tr></thead><tbody>${data.items.map((item) => {
        let preview = '';
        try { const url = new URL(item.previewUrl); if (url.protocol === 'https:' && url.hostname === 'ethereal.email') preview = `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">Ver captura Ethereal</a>`; } catch { /* No valid preview. */ }
        return `<tr><td>#${Number(item.pedido_id)}<br>${escape(new Date(item.fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }))}</td><td>${escape(labels[item.deliveryStatus] || item.deliveryStatus)}<br>Intentos: ${Number(item.attempts)}<br>${escape(item.lastError || '')}</td><td><details><summary>${escape(item.asunto)}</summary><p>Propietario: ${escape(item.destinatario)}</p><p style="white-space:pre-wrap">${escape(item.cuerpo)}</p></details></td><td>${preview}${['en_cola', 'fallo'].includes(item.deliveryStatus) ? `<button type="button" class="btn-edit" data-retry-mail="${Number(item.id)}">Reintentar</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p>No hay correos registrados.</p>';
      for (const [label, next, enabled] of [['Anterior', page - 1, data.pagination.hasPreviousPage], ['Siguiente', page + 1, data.pagination.hasNextPage]]) {
        if (!enabled) continue;
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.onclick = () => window.loadOrderMail(next); output.append(button);
      }
      output.querySelectorAll('[data-retry-mail]').forEach((button) => { button.onclick = async () => {
        button.disabled = true;
        try { await api(`notificaciones-correo/${button.dataset.retryMail}/reintentar`, 'POST'); await window.loadOrderMail(mailPage); }
        catch (error) { button.disabled = false; const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = error.message; output.prepend(message); }
      }; });
    } catch (error) { if (version === mailVersion) output.textContent = error.message; }
  };
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('metrics-filter'); if (!form) return;
    const now = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'America/Argentina/Buenos_Aires', month: 'numeric', year: 'numeric' }).formatToParts(new Date()).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
    const select = document.getElementById('metrics-month');
    for (let month = 1; month <= 12; month++) { const option = document.createElement('option'); option.value = month; option.textContent = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 1))); select.append(option); }
    const years = document.getElementById('metrics-year');
    for (let year = 2100; year >= 2000; year--) { const option = document.createElement('option'); option.value = year; option.textContent = year; years.append(option); }
    select.value = now.month; document.getElementById('metrics-year').value = now.year;
    form.onsubmit = (event) => { event.preventDefault(); window.loadMetrics(); };
    document.getElementById('mail-refresh').onclick = () => window.loadOrderMail(mailPage);
  });
})();
