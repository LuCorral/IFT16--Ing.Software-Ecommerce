/* Account forms share the existing navigation and notification helpers. */
(() => {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let fieldId = 0;
  const field = (name, label, value = '', type = 'text', extra = '') => {
    const id = `account-field-${++fieldId}`;
    return `<div class="input-group"><label for="${id}">${label}</label><input id="${id}" name="${name}" type="${type}" value="${escape(value)}" ${extra}></div>`;
  };
  const password = (name, label, current = false) => field(name, label, '', 'password', `required autocomplete="${current ? 'current-password' : 'new-password'}" ${current ? '' : 'minlength="6"'}`);
  const newPassword = () => password('password', 'Nueva contraseña (mínimo 6 caracteres)') + password('confirmPassword', 'Confirmar nueva contraseña');
  async function request(path, method, body, authenticated = true) {
    const response = await fetch(`/api/auth/${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) },
      body: JSON.stringify(body), cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo completar la operación');
    return data;
  }
  function bind(form, action) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      const status = form.querySelector('[role="status"]');
      const values = Object.fromEntries(new FormData(form));
      if ('confirmPassword' in values && values.password !== values.confirmPassword) {
        status.textContent = 'Las contraseñas no coinciden'; return;
      }
      button.disabled = true;
      status.textContent = 'Procesando…';
      try { await action(values, status); }
      catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    });
  }
  const status = '<p role="status" aria-live="polite" class="account-status"></p>';
  function endSession(message) {
    clearUserSession(); clearCartState();
    sessionStorage.setItem('account-message', message);
    window.location.assign('/login.html');
  }
  window.renderAccountProfile = (container, user) => {
    container.innerHTML = `
      <form id="account-profile" class="account-form">
        <h2>Datos personales</h2>
        ${field('name', 'Nombre', user.name, 'text', 'required maxlength="100" autocomplete="given-name"')}
        ${field('apellido', 'Apellido', user.apellido, 'text', 'required maxlength="100" autocomplete="family-name"')}
        ${field('email', 'Correo electrónico', user.email, 'email', 'required maxlength="254" autocomplete="email"')}
        ${field('telefono', 'Teléfono (opcional)', user.telefono, 'tel', 'pattern="[0-9]{1,30}" maxlength="30" autocomplete="tel"')}
        <button type="submit" class="btn-auth">Guardar cambios</button>${status}
      </form>
      <form id="account-password" class="account-form">
        <h2>Cambiar contraseña</h2>
        ${password('currentPassword', 'Contraseña actual', true)}${newPassword()}
        <button type="submit" class="btn-auth">Cambiar contraseña</button>${status}
      </form>
      <section class="account-form account-danger">
        <h2>Eliminar cuenta</h2>
        <p>Se eliminarán tus datos de cuenta y se anonimizarán los datos personales de tus pedidos y comprobantes. Esta acción es permanente.</p>
        <button type="button" id="account-delete-open" class="btn-auth">Eliminar mi cuenta</button>
        <dialog id="account-delete-dialog" aria-labelledby="account-delete-title">
          <form id="account-delete">
            <h2 id="account-delete-title">Confirmar eliminación</h2>
            <p>Para eliminar tu cuenta, ingresá tu contraseña y escribí ELIMINAR.</p>
            ${password('password', 'Contraseña actual', true)}
            ${field('confirmation', 'Confirmación', '', 'text', 'required pattern="ELIMINAR" autocomplete="off"')}
            <div class="account-actions"><button type="button" id="account-delete-cancel">Cancelar</button><button type="submit" class="btn-auth">Eliminar definitivamente</button></div>${status}
          </form>
        </dialog>
      </section>`;
    bind(document.getElementById('account-profile'), async (values, output) => {
      const result = await request('profile', 'PUT', values);
      localStorage.setItem('userName', result.user.name);
      localStorage.setItem('userSurname', result.user.apellido);
      updateAuthNavigation(); output.textContent = result.message;
    });
    bind(document.getElementById('account-password'), async (values) => {
      const result = await request('password', 'PUT', values); endSession(result.message);
    });
    const dialog = document.getElementById('account-delete-dialog');
    document.getElementById('account-delete-open').onclick = () => dialog.showModal();
    const resetDelete = () => { document.getElementById('account-delete').reset(); dialog.querySelector('[role="status"]').textContent = ''; };
    dialog.addEventListener('close', resetDelete);
    document.getElementById('account-delete-cancel').onclick = () => dialog.close();
    bind(document.getElementById('account-delete'), async (values) => {
      const result = await request('account', 'DELETE', values); endSession(result.message);
    });
  };
  document.addEventListener('DOMContentLoaded', () => {
    const login = document.getElementById('form-login');
    if (!login) return;
    const message = sessionStorage.getItem('account-message');
    if (message) { sessionStorage.removeItem('account-message'); const output = document.createElement('p'); output.setAttribute('role', 'status'); output.textContent = message; login.prepend(output); }
    let resetToken = new URLSearchParams(location.hash.slice(1)).get('reset');
    // Remove sensitive fragments from the visible address and browser history.
    if (resetToken) history.replaceState(null, '', location.pathname);
    const recovery = document.createElement('form');
    recovery.id = 'account-recovery'; recovery.className = 'account-form'; recovery.hidden = true;
    login.closest('.auth-container').append(recovery);
    function openRecovery(reset = false) {
      document.querySelectorAll('.auth-tabs, #form-login, #form-register').forEach((el) => { el.hidden = true; el.classList.remove('active'); });
      recovery.hidden = false;
      recovery.innerHTML = `<h2>${reset ? 'Crear nueva contraseña' : 'Recuperar contraseña'}</h2>${reset ? newPassword() : field('email', 'Correo electrónico', '', 'email', 'required autocomplete="email" maxlength="254"')}<button type="submit" class="btn-auth">${reset ? 'Guardar contraseña' : 'Enviar enlace'}</button>${status}<a href="/login.html" class="auth-link">Volver a iniciar sesión</a>`;
    }
    document.getElementById('forgot-password-link').onclick = (event) => { event.preventDefault(); openRecovery(); };
    bind(recovery, async (values, output) => {
      const result = await request(resetToken ? 'reset-password' : 'forgot-password', 'POST', resetToken ? { ...values, token: resetToken } : values, false);
      if (resetToken) { resetToken = null; endSession(result.message); }
      else { output.textContent = result.message; recovery.reset(); }
    });
    window.addEventListener('hashchange', () => {
      const incoming = new URLSearchParams(location.hash.slice(1)).get('reset');
      if (!incoming) return;
      resetToken = incoming;
      history.replaceState(null, '', location.pathname);
      openRecovery(true);
    });
    if (resetToken) openRecovery(true);
  });
})();
