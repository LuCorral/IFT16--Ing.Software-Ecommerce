(() => {
  const money = (cents) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(cents) / 100);
  window.formatCorporateMoney = money;
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const api = async (path, method = 'GET', body) => {
    const response = await fetch(`/api/usuarios/${path}`, {
      method, headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo consultar el beneficio');
    return data;
  };
  let selectedId, requestId, pendingAmount, busy = false;
  async function refreshMovements(page = 1) {
    const result = await api(`${selectedId}/movimientos-corporativos?page=${page}`);
    const container = document.getElementById('corporate-movements');
    container.innerHTML = result.items.length ? `<div class="admin-table-container"><table class="admin-table"><thead><tr><th>Fecha</th><th>Administrador</th><th>Importe</th><th>Saldo resultante</th></tr></thead><tbody>${result.items.map((item) => `<tr><td>${escape(new Date(item.createdAt).toLocaleString('es-AR'))}</td><td>${item.adminId == null ? 'Usuario eliminado' : `Admin #${Number(item.adminId)}`}</td><td>${money(item.amountCents)}</td><td>${money(item.balanceAfterCents)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Todavía no hay movimientos.</p>';
    if (result.pagination.hasPreviousPage || result.pagination.hasNextPage) {
      const controls = document.createElement('div'); controls.className = 'account-actions';
      for (const [label, next, enabled] of [['Anterior', page - 1, result.pagination.hasPreviousPage], ['Siguiente', page + 1, result.pagination.hasNextPage]]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.disabled = !enabled;
        button.onclick = () => refreshMovements(next).catch((error) => { document.getElementById('corporate-status').textContent = error.message; }); controls.append(button);
      }
      container.append(controls);
    }
  }
  window.openCorporateBenefit = async (id) => {
    if (busy) return;
    try {
      const user = await api(id);
      selectedId = Number(id); requestId = null; pendingAmount = null;
      const dialog = document.getElementById('corporate-dialog');
      dialog.innerHTML = `<h2 id="corporate-dialog-title">Beneficio corporativo</h2>
        <p>${escape(user.name)} ${escape(user.apellido)} · ${escape(user.email)}</p>
        <p>Saldo disponible: <strong id="corporate-balance">${money(user.corporateBalanceCents)}</strong></p>
        <form id="corporate-condition-form" class="account-form">
          <label><input type="checkbox" id="corporate-enabled" ${user.corporateEnabled ? 'checked' : ''}> Beneficio corporativo activo</label>
          <p>Desactivar conserva el saldo y bloquea nuevas asignaciones.</p>
          <button type="submit" class="btn-modal-save">Guardar condición</button>
        </form>
        <form id="corporate-credit-form" class="account-form">
          <label for="corporate-amount">Importe a sumar al saldo (ARS)</label>
          <input id="corporate-amount" type="number" min="0.01" max="1000000000" step="0.01" required placeholder="Ej. 50000" ${user.corporateEnabled ? '' : 'disabled'}>
          <button type="submit" class="btn-modal-save" ${user.corporateEnabled ? '' : 'disabled'}>Asignar crédito</button>
        </form>
        <p role="status" id="corporate-status" aria-live="polite"></p>
        <h3>Movimientos</h3><div id="corporate-movements"></div>
        <button type="button" id="corporate-close" class="btn-modal-cancel">Cerrar</button>`;
      let enabled = user.corporateEnabled;
      const toggleCredit = () => dialog.querySelectorAll('#corporate-credit-form input, #corporate-credit-form button').forEach((el) => { el.disabled = !enabled; });
      const bind = (form, action) => form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy) return;
        busy = true;
        const buttons = dialog.querySelectorAll('button, input'); buttons.forEach((el) => { el.disabled = true; });
        const status = document.getElementById('corporate-status'); status.textContent = 'Guardando…';
        try {
          const result = await action();
          enabled = result.user.corporateEnabled;
          document.getElementById('corporate-enabled').checked = enabled;
          document.getElementById('corporate-balance').textContent = money(result.user.corporateBalanceCents);
          status.textContent = result.message; showNotification(result.message);
          await refreshMovements(); await window.loadCustomers(1);
        } catch (error) { status.textContent = error.message; }
        finally { busy = false; buttons.forEach((el) => { el.disabled = false; }); toggleCredit(); }
      });
      bind(document.getElementById('corporate-condition-form'), () => api(`${selectedId}/corporativo`, 'PUT', { enabled: document.getElementById('corporate-enabled').checked }));
      bind(document.getElementById('corporate-credit-form'), async () => {
        const amount = document.getElementById('corporate-amount').value;
        // Keep the key after network failure so retrying cannot duplicate credit.
        if (!requestId || pendingAmount !== amount) { requestId = crypto.randomUUID(); pendingAmount = amount; }
        const result = await api(`${selectedId}/credito-corporativo`, 'POST', { amount, requestId });
        requestId = null; pendingAmount = null; document.getElementById('corporate-amount').value = '';
        return result;
      });
      document.getElementById('corporate-close').onclick = () => dialog.close();
      dialog.showModal(); await refreshMovements();
    } catch (error) { showNotification(error.message, 'error'); }
  };
  document.addEventListener('DOMContentLoaded', () => {
    const dialog = document.createElement('dialog'); dialog.id = 'corporate-dialog'; dialog.className = 'corporate-dialog'; dialog.setAttribute('aria-labelledby', 'corporate-dialog-title'); document.body.append(dialog);
    dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
    document.getElementById('customer-search-form').addEventListener('submit', (event) => { event.preventDefault(); window.loadCustomers(1); });
    document.getElementById('customer-search-clear').onclick = () => { document.getElementById('customer-search').value = ''; window.loadCustomers(1); };
  });
})();
