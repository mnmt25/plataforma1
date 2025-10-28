const state = {
  token: localStorage.getItem('sessionToken') || null,
  user: null,
  locale: localStorage.getItem('locale') || 'es',
  translations: {},
  view: 'dashboard',
  data: {
    dashboard: null,
    solicitudes: [],
    solicitudesTotal: 0,
    page: 1,
    size: 20,
    sort: 'fecha_creacion,DESC',
    detalle: null,
    origenes: [],
    motivos: [],
    usuarios: [],
    auditoria: [],
    auditoriaPage: 1
  },
  filters: JSON.parse(localStorage.getItem('filters.solicitudes') || '{}'),
  modal: null,
  loading: false
};

const statusLabels = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  en_analisis: 'En análisis',
  cerrado: 'Cerrado'
};

async function init() {
  await loadTranslations(state.locale);
  if (state.token) {
    try {
      await ensureSession();
      await loadBaseData();
    } catch (err) {
      clearSession();
    }
  }
  render();
  if (state.user) {
    await refreshViewData();
  }
}

document.addEventListener('DOMContentLoaded', init);

function t(key) {
  return state.translations[key] || key;
}

async function loadTranslations(locale) {
  const res = await fetch(`/ui/i18n/${locale}.json`);
  state.translations = await res.json();
  document.documentElement.lang = locale;
}

async function ensureSession() {
  const me = await apiFetch('/api/auth/me');
  state.user = me;
  state.token = localStorage.getItem('sessionToken');
}

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('sessionToken');
}

async function apiFetch(url, options = {}) {
  const headers = options.headers || {};
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    showToast(error.code || 'Error', true);
    throw new Error(error.code || 'Error');
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function showToast(message, isError = false) {
  const container = document.querySelector('.toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  if (isError) {
    toast.style.background = '#e53e3e';
  }
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.email.value.trim();
  const credencial = form.credencial.value.trim();
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, credencial }
    });
    state.token = data.token;
    state.user = { id: data.id, nombre: data.nombre, rol: data.rol, email };
    localStorage.setItem('sessionToken', data.token);
    await loadBaseData();
    state.view = 'dashboard';
    render();
    await refreshViewData();
  } catch (error) {
    showToast(t('notificaciones.error'), true);
  }
}

async function loadBaseData() {
  const [origenes, motivos] = await Promise.all([
    apiFetch('/api/catalogos/origenes'),
    apiFetch('/api/catalogos/motivos')
  ]);
  state.data.origenes = origenes;
  state.data.motivos = motivos;
  if (state.user.rol === 'admin') {
    state.data.usuarios = await apiFetch('/api/usuarios');
  } else {
    state.data.usuarios = [state.user];
  }
}

async function refreshViewData() {
  switch (state.view) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'solicitudes':
      await loadSolicitudes();
      break;
    case 'catalogos':
      // nothing additional; list is in state
      render();
      break;
    case 'usuarios':
      if (state.user.rol === 'admin') {
        state.data.usuarios = await apiFetch('/api/usuarios');
      }
      render();
      break;
    case 'auditoria':
      await loadAuditoria();
      break;
    default:
      render();
  }
}

async function loadDashboard() {
  const resumen = await apiFetch('/api/solicitudes/dashboard/resumen');
  state.data.dashboard = resumen;
  render();
  drawCharts(resumen);
}

async function loadSolicitudes(page = state.data.page, sort = state.data.sort) {
  const filters = getSolicitudFilters();
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('size', state.data.size);
  if (sort) params.set('sort', sort);
  if (filters.query) params.set('query', filters.query);
  if (filters.desde) params.set('desde', filters.desde);
  if (filters.hasta) params.set('hasta', filters.hasta);
  (filters.estados || []).forEach((value) => params.append('estado', value));
  (filters.origenes || []).forEach((value) => params.append('origen', value));
  (filters.motivos || []).forEach((value) => params.append('motivo', value));
  if (filters.creador) params.set('creador', filters.creador);
  const data = await apiFetch(`/api/solicitudes?${params.toString()}`);
  state.data.solicitudes = data.items;
  state.data.solicitudesTotal = data.total;
  state.data.page = data.page;
  state.data.sort = sort;
  render();
}

async function loadAuditoria(page = 1) {
  const params = new URLSearchParams({ page: String(page), limit: '200' });
  const data = await apiFetch(`/api/auditoria?${params.toString()}`);
  state.data.auditoria = data;
  state.data.auditoriaPage = page;
  render();
}

function getSolicitudFilters() {
  return {
    query: state.filters.query || '',
    estados: state.filters.estados || [],
    origenes: state.filters.origenes || [],
    motivos: state.filters.motivos || [],
    creador: state.filters.creador || '',
    desde: state.filters.desde || '',
    hasta: state.filters.hasta || ''
  };
}

function persistFilters() {
  localStorage.setItem('filters.solicitudes', JSON.stringify(state.filters));
}

function render() {
  const app = document.getElementById('app');
  if (!state.user) {
    app.innerHTML = renderLogin();
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('locale-switch').addEventListener('change', async (e) => {
      state.locale = e.target.value;
      localStorage.setItem('locale', state.locale);
      await loadTranslations(state.locale);
      render();
    });
    return;
  }
  app.innerHTML = renderShell();
  attachShellEvents();
  if (state.modal) {
    renderModal();
  }
}

function renderLogin() {
  return `
    <div class="login-container" role="form">
      <h2>${t('login.title')}</h2>
      <form id="login-form">
        <div class="form-field">
          <label for="email">${t('login.email')}</label>
          <input id="email" name="email" type="email" required autocomplete="email" />
        </div>
        <div class="form-field">
          <label for="credencial">${t('login.password')}</label>
          <input id="credencial" name="credencial" type="password" required minlength="10" autocomplete="current-password" />
        </div>
        <div class="form-field">
          <label for="locale-switch">Idioma</label>
          <select id="locale-switch" aria-label="Seleccionar idioma">
            <option value="es" ${state.locale === 'es' ? 'selected' : ''}>${t('idioma.es')}</option>
            <option value="en" ${state.locale === 'en' ? 'selected' : ''}>${t('idioma.en')}</option>
          </select>
        </div>
        <button type="submit">${t('login.submit')}</button>
      </form>
    </div>
  `;
}

function renderShell() {
  return `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Main navigation">
        <div>
          <h1>${t('app.title')}</h1>
          <span class="badge-role">${state.user.nombre} (${state.user.rol})</span>
        </div>
        <nav>
          ${renderNavLink('dashboard', t('nav.dashboard'))}
          ${renderNavLink('solicitudes', t('nav.solicitudes'))}
          ${renderNavLink('catalogos', t('nav.catalogos'))}
          ${state.user.rol === 'admin' ? renderNavLink('usuarios', t('nav.usuarios')) : ''}
          ${state.user.rol === 'admin' ? renderNavLink('auditoria', t('nav.auditoria')) : ''}
        </nav>
        <div style="margin-top:auto;">
          <button class="secondary" id="logout-btn">${t('nav.cerrar')}</button>
        </div>
      </aside>
      <main class="main" tabindex="-1">
        ${renderView()}
      </main>
    </div>
  `;
}

function renderNavLink(view, label) {
  return `<a href="#" data-view="${view}" class="${state.view === view ? 'active' : ''}">${label}</a>`;
}

function renderView() {
  switch (state.view) {
    case 'dashboard':
      return renderDashboard();
    case 'solicitudes':
      return renderSolicitudes();
    case 'catalogos':
      return renderCatalogos();
    case 'usuarios':
      return renderUsuarios();
    case 'auditoria':
      return renderAuditoria();
    default:
      return '';
  }
}

function renderDashboard() {
  const data = state.data.dashboard;
  if (!data) {
    return `<p>Cargando...</p>`;
  }
  const recientes = data.recientes
    .map(
      (item) => `
        <tr data-id="${item.id}" class="solicitud-link" tabindex="0">
          <td>${item.id}</td>
          <td>${formatDate(item.fecha_creacion)}</td>
          <td><span class="badge ${item.estado}">${statusLabels[item.estado]}</span></td>
          <td>${item.job || ''}</td>
          <td>${item.id_muestra || ''}</td>
          <td>${item.analito || ''}</td>
        </tr>
      `
    )
    .join('');
  return `
    <div class="header">
      <h2>${t('nav.dashboard')}</h2>
      <div class="actions">
        <select id="locale-switch" aria-label="Idioma">
          <option value="es" ${state.locale === 'es' ? 'selected' : ''}>${t('idioma.es')}</option>
          <option value="en" ${state.locale === 'en' ? 'selected' : ''}>${t('idioma.en')}</option>
        </select>
      </div>
    </div>
    <section class="card-grid" aria-label="${t('nav.dashboard')}">
      <article class="card"><h3>${t('dashboard.total')}</h3><div class="value">${data.total}</div></article>
      <article class="card"><h3>${t('dashboard.promedio')}</h3><div class="value">${data.promedioHorasResolucion}</div></article>
    </section>
    <section class="chart-area">
      <div class="card canvas-card"><h3>${t('dashboard.estado')}</h3><canvas id="chart-estado" aria-label="${t('dashboard.estado')}" role="img"></canvas></div>
      <div class="card canvas-card"><h3>${t('dashboard.topOrigen')}</h3><canvas id="chart-origen" aria-label="${t('dashboard.topOrigen')}" role="img"></canvas></div>
      <div class="card canvas-card"><h3>${t('dashboard.topMotivo')}</h3><canvas id="chart-motivo" aria-label="${t('dashboard.topMotivo')}" role="img"></canvas></div>
    </section>
    <section class="card" style="margin-top:1.5rem;">
      <h3>${t('dashboard.recientes')}</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr><th>ID</th><th>${t('filtros.desde')}</th><th>${t('filtros.estado')}</th><th>Job</th><th>ID Muestra</th><th>Analito</th></tr>
          </thead>
          <tbody>
            ${recientes || `<tr><td colspan="6">${t('tabla.sinDatos')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSolicitudes() {
  const filters = getSolicitudFilters();
  const rows = state.data.solicitudes
    .map(
      (item) => `
        <tr data-id="${item.id}" class="solicitud-link" tabindex="0">
          <td>${item.id}</td>
          <td>${formatDate(item.fecha_creacion)}</td>
          <td><span class="badge ${item.estado}">${statusLabels[item.estado]}</span></td>
          <td>${item.job || ''}</td>
          <td>${item.id_muestra || ''}</td>
          <td>${item.analito || ''}</td>
          <td>${item.origen_nombre}</td>
          <td>${item.motivo_nombre}</td>
          <td>${item.creador_nombre}</td>
          <td>${formatDate(item.fecha_actualizacion)}</td>
        </tr>
      `
    )
    .join('');
  const paginas = Math.ceil(state.data.solicitudesTotal / state.data.size);
  return `
    <div class="header">
      <h2>${t('solicitudes.titulo')}</h2>
      <div class="actions">
        <button id="exportar-btn">${t('acciones.exportar')}</button>
        <button id="nueva-solicitud">${t('solicitudes.nueva')}</button>
      </div>
    </div>
    <section>
      <div class="table-filters" aria-label="${t('solicitudes.filtros')}">
        <label>
          <span class="sr-only">${t('filtros.buscar')}</span>
          <input type="search" id="filtro-query" placeholder="${t('filtros.buscar')}" value="${filters.query}" />
        </label>
       <label>
         <span class="sr-only">${t('filtros.estado')}</span>
         <select id="filtro-estado" multiple size="4">
            ${Object.entries(statusLabels)
              .map(([key, label]) => `<option value="${key}" ${filters.estados.includes(key) ? 'selected' : ''}>${label}</option>`)
              .join('')}
         </select>
       </label>
        <label>
          <span class="sr-only">${t('filtros.origen')}</span>
          <select id="filtro-origen" multiple size="5">
            ${state.data.origenes
              .map((o) => `<option value="${o.id}" ${filters.origenes.includes(String(o.id)) ? 'selected' : ''}>${o.nombre}</option>`)
              .join('')}
          </select>
        </label>
        <label>
          <span class="sr-only">${t('filtros.motivo')}</span>
          <select id="filtro-motivo" multiple size="5">
            ${state.data.motivos
              .map((m) => `<option value="${m.id}" ${filters.motivos.includes(String(m.id)) ? 'selected' : ''}>${m.nombre}</option>`)
              .join('')}
          </select>
        </label>
        <label>
          <span class="sr-only">${t('filtros.creador')}</span>
          <select id="filtro-creador">
            <option value="">${t('filtros.creador')}</option>
            ${state.data.usuarios
              .map((u) => `<option value="${u.id}" ${filters.creador === String(u.id) ? 'selected' : ''}>${u.nombre}</option>`)
              .join('')}
          </select>
        </label>
        <label>
          <span class="sr-only">${t('filtros.desde')}</span>
          <input type="date" id="filtro-desde" value="${filters.desde || ''}" />
        </label>
        <label>
          <span class="sr-only">${t('filtros.hasta')}</span>
          <input type="date" id="filtro-hasta" value="${filters.hasta || ''}" />
        </label>
        <button id="aplicar-filtros">${t('acciones.guardar')}</button>
        <button class="secondary" id="limpiar-filtros">Limpiar</button>
      </div>
      <div class="table-container" role="region" aria-live="polite">
        <table>
          <thead>
            <tr>
              ${renderSolicitudesHeader('id', 'ID')}
              ${renderSolicitudesHeader('fecha_creacion', 'Fecha')}
              ${renderSolicitudesHeader('estado', t('filtros.estado'))}
              ${renderSolicitudesHeader('job', 'Job')}
              ${renderSolicitudesHeader('id_muestra', 'ID Muestra')}
              ${renderSolicitudesHeader('analito', 'Analito')}
              ${renderSolicitudesHeader('origen', t('filtros.origen'))}
              ${renderSolicitudesHeader('motivo', t('filtros.motivo'))}
              ${renderSolicitudesHeader('creador', t('filtros.creador'))}
              ${renderSolicitudesHeader('ultima_actualizacion', 'Actualización')}
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="10">${t('tabla.sinDatos')}</td></tr>`}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem;">
        <div>Page ${state.data.page} / ${paginas || 1}</div>
        <div>
          <button id="prev-page" ${state.data.page <= 1 ? 'disabled' : ''}>&lt;</button>
          <button id="next-page" ${state.data.page >= paginas ? 'disabled' : ''}>&gt;</button>
        </div>
      </div>
      ${state.data.detalle ? renderDetalle(state.data.detalle) : ''}
    </section>
  `;
}

function renderSolicitudesHeader(field, label) {
  const currentField = state.data.sort.split(',')[0];
  const direction = state.data.sort.split(',')[1];
  const indicator = currentField === field ? (direction === 'ASC' ? '▲' : '▼') : '';
  return `<th data-sort="${field}">${label} ${indicator}</th>`;
}

function renderDetalle(detalle) {
  const historial = (detalle.historial_cambios || [])
    .map(
      (item) => `<li>${formatDate(item.fecha)}: ${statusLabels[item.de] || '-'} → ${statusLabels[item.a]} (${item.nota || ''})</li>`
    )
    .join('');
  const snapshot = Object.entries(detalle.snapshot_datos || {})
    .map(([key, value]) => `<li><strong>${key}</strong>: ${typeof value === 'object' ? JSON.stringify(value) : value}</li>`)
    .join('');
  return `
    <section class="card" style="margin-top:1.5rem;">
      <h3>${t('solicitud.detalle')} #${detalle.id}</h3>
      <div class="tab-buttons">
        <button id="accion-editar" ${detalle.estado !== 'borrador' && state.user.rol !== 'admin' ? 'disabled' : ''}>${t('acciones.editar')}</button>
        ${renderTransicionButtons(detalle)}
      </div>
      <div class="card-grid">
        <div>
          <h4>${t('solicitud.snapshot')}</h4>
          <ul>${snapshot || '<li>Sin datos</li>'}</ul>
        </div>
        <div>
          <h4>${t('solicitud.observaciones')}</h4>
          <p>${detalle.observaciones || '—'}</p>
        </div>
        <div>
          <h4>${t('solicitud.historial')}</h4>
          <ul>${historial}</ul>
        </div>
      </div>
    </section>
  `;
}

function renderTransicionButtons(detalle) {
  const buttons = [];
  const flujo = {
    usuario: {
      borrador: ['en_revision'],
      en_revision: ['en_analisis']
    },
    admin: {
      borrador: ['en_revision'],
      en_revision: ['en_analisis'],
      en_analisis: ['cerrado'],
      cerrado: ['en_analisis']
    }
  };
  const rolKey = state.user.rol === 'admin' ? 'admin' : 'usuario';
  const destinos = flujo[rolKey][detalle.estado] || [];
  destinos.forEach((destino) => {
    buttons.push(`<button data-transicion="${destino}">${statusLabels[destino]}</button>`);
  });
  return buttons.join('');
}

function renderCatalogos() {
  const origenes = state.data.origenes
    .map((o) => `
      <tr data-type="origen" data-id="${o.id}">
        <td>${o.nombre}</td>
        <td>${o.descripcion || ''}</td>
        <td>${o.activo ? 'Sí' : 'No'}</td>
        <td>${o.contador_uso}</td>
        ${state.user.rol === 'admin' ? '<td><button data-action="edit">Editar</button></td>' : ''}
      </tr>
    `)
    .join('');
  const motivos = state.data.motivos
    .map((m) => `
      <tr data-type="motivo" data-id="${m.id}">
        <td>${m.nombre}</td>
        <td>${m.descripcion || ''}</td>
        <td>${m.activo ? 'Sí' : 'No'}</td>
        <td>${m.contador_uso}</td>
        ${state.user.rol === 'admin' ? '<td><button data-action="edit">Editar</button></td>' : ''}
      </tr>
    `)
    .join('');
  return `
    <div class="header">
      <h2>${t('nav.catalogos')}</h2>
      ${state.user.rol === 'admin' ? `<div class="actions"><button id="nuevo-origen">${t('catalogos.nuevo')} Origen</button><button id="nuevo-motivo">${t('catalogos.nuevo')} Motivo</button></div>` : ''}
    </div>
    <section class="card">
      <h3>${t('catalogos.origenes')}</h3>
      <div class="table-container">
        <table>
          <thead><tr><th>Nombre</th><th>${t('catalogos.origenes')}</th><th>Activo</th><th>Uso</th>${state.user.rol === 'admin' ? '<th></th>' : ''}</tr></thead>
          <tbody>${origenes || `<tr><td colspan="5">${t('tabla.sinDatos')}</td></tr>`}</tbody>
        </table>
      </div>
    </section>
    <section class="card" style="margin-top:1.5rem;">
      <h3>${t('catalogos.motivos')}</h3>
      <div class="table-container">
        <table>
          <thead><tr><th>Nombre</th><th>${t('catalogos.motivos')}</th><th>Activo</th><th>Uso</th>${state.user.rol === 'admin' ? '<th></th>' : ''}</tr></thead>
          <tbody>${motivos || `<tr><td colspan="5">${t('tabla.sinDatos')}</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderUsuarios() {
  const rows = state.data.usuarios
    .map((u) => `
      <tr data-id="${u.id}">
        <td>${u.nombre}</td>
        <td>${u.email}</td>
        <td>${u.rol}</td>
        <td>${u.area || ''}</td>
        <td>${u.activo ? 'Sí' : 'No'}</td>
        <td>${u.ultimo_acceso ? formatDate(u.ultimo_acceso) : '—'}</td>
        <td><button data-action="edit">${t('acciones.editar')}</button></td>
      </tr>
    `)
    .join('');
  return `
    <div class="header">
      <h2>${t('usuarios.titulo')}</h2>
      <button id="nuevo-usuario">${t('catalogos.nuevo')}</button>
    </div>
    <section class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Área</th><th>Activo</th><th>Último acceso</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7">${t('tabla.sinDatos')}</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAuditoria() {
  const rows = state.data.auditoria
    .map(
      (item) => `<tr><td>${formatDate(item.fecha)}</td><td>${item.usuario_nombre || ''}</td><td>${item.accion}</td><td>${item.entidad}</td><td>${item.entidad_id || ''}</td><td>${JSON.stringify(item.detalle)}</td></tr>`
    )
    .join('');
  return `
    <div class="header"><h2>${t('auditoria.titulo')}</h2></div>
    <section class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>ID</th><th>Detalle</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6">${t('tabla.sinDatos')}</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function attachShellEvents() {
  document.querySelectorAll('.sidebar nav a').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      const view = event.currentTarget.getAttribute('data-view');
      if (state.view !== view) {
        state.view = view;
        render();
        await refreshViewData();
      }
    });
  });
  const localeSwitch = document.getElementById('locale-switch');
  if (localeSwitch) {
    localeSwitch.addEventListener('change', async (e) => {
      state.locale = e.target.value;
      localStorage.setItem('locale', state.locale);
      await loadTranslations(state.locale);
      render();
      await refreshViewData();
    });
  }
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      // ignore
    }
    clearSession();
    render();
  });

  if (state.view === 'dashboard') {
    document.querySelectorAll('.solicitud-link').forEach((row) => {
      row.addEventListener('click', async () => {
        state.view = 'solicitudes';
        render();
        await loadSolicitudes();
        await mostrarDetalle(Number(row.dataset.id));
      });
    });
  }
  if (state.view === 'solicitudes') {
    document.getElementById('nueva-solicitud').addEventListener('click', () => openSolicitudForm());
    document.getElementById('aplicar-filtros').addEventListener('click', async () => {
      state.filters.query = document.getElementById('filtro-query').value;
      state.filters.estados = Array.from(document.getElementById('filtro-estado').selectedOptions).map((o) => o.value);
      state.filters.origenes = Array.from(document.getElementById('filtro-origen').selectedOptions).map((o) => o.value);
      state.filters.motivos = Array.from(document.getElementById('filtro-motivo').selectedOptions).map((o) => o.value);
      state.filters.creador = document.getElementById('filtro-creador').value;
      state.filters.desde = document.getElementById('filtro-desde').value;
      state.filters.hasta = document.getElementById('filtro-hasta').value;
      persistFilters();
      await loadSolicitudes(1, state.data.sort);
    });
    document.getElementById('limpiar-filtros').addEventListener('click', async () => {
      state.filters = {};
      persistFilters();
      await loadSolicitudes(1, state.data.sort);
    });
    document.querySelectorAll('th[data-sort]').forEach((th) => {
      th.addEventListener('click', async () => {
        const field = th.dataset.sort;
        const current = state.data.sort.split(',');
        let direction = 'ASC';
        if (current[0] === field && current[1] === 'ASC') {
          direction = 'DESC';
        }
        const sort = `${field},${direction}`;
        await loadSolicitudes(state.data.page, sort);
      });
    });
    document.getElementById('prev-page').addEventListener('click', async () => {
      if (state.data.page > 1) {
        await loadSolicitudes(state.data.page - 1, state.data.sort);
      }
    });
    document.getElementById('next-page').addEventListener('click', async () => {
      const paginas = Math.ceil(state.data.solicitudesTotal / state.data.size);
      if (state.data.page < paginas) {
        await loadSolicitudes(state.data.page + 1, state.data.sort);
      }
    });
    document.querySelectorAll('.solicitud-link').forEach((row) => {
      row.addEventListener('click', async () => {
        await mostrarDetalle(Number(row.dataset.id));
      });
    });
    const exportBtn = document.getElementById('exportar-btn');
    exportBtn.addEventListener('click', async () => {
      try {
        const result = await apiFetch('/api/export/solicitudes', { method: 'POST', body: getSolicitudFilters() });
        const blob = base64ToBlob(result.contenido, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = result.archivo;
        link.click();
        showToast('Archivo exportado');
      } catch (error) {
        // handled in apiFetch
      }
    });
  }
  if (state.view === 'catalogos' && state.user.rol === 'admin') {
    document.querySelectorAll('table tbody tr button[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr');
        const type = tr.dataset.type;
        const id = Number(tr.dataset.id);
        const item = (type === 'origen' ? state.data.origenes : state.data.motivos).find((x) => x.id === id);
        openCatalogoForm(type, item);
      });
    });
    document.getElementById('nuevo-origen')?.addEventListener('click', () => openCatalogoForm('origen'));
    document.getElementById('nuevo-motivo')?.addEventListener('click', () => openCatalogoForm('motivo'));
  }
  if (state.view === 'usuarios' && state.user.rol === 'admin') {
    document.getElementById('nuevo-usuario').addEventListener('click', () => openUsuarioForm());
    document.querySelectorAll('table tbody tr button[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.closest('tr').dataset.id);
        const usuario = state.data.usuarios.find((u) => u.id === id);
        openUsuarioForm(usuario);
      });
    });
  }
}

async function mostrarDetalle(id) {
  const detalle = await apiFetch(`/api/solicitudes/${id}`);
  state.data.detalle = detalle;
  render();
  attachShellEvents();
  document.getElementById('accion-editar')?.addEventListener('click', () => openSolicitudForm(state.data.detalle));
  document.querySelectorAll('[data-transicion]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const destino = btn.dataset.transicion;
      try {
        state.data.detalle = await apiFetch(`/api/solicitudes/${id}/estado`, {
          method: 'POST',
          body: { a: destino }
        });
        showToast(t('notificaciones.guardado'));
        await loadSolicitudes(state.data.page, state.data.sort);
      } catch (error) {
        // handled by apiFetch
      }
    });
  });
}

function renderModal() {
  const existing = document.getElementById('modal');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'modal';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.35)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.innerHTML = `
    <div style="background:#fff;padding:1.5rem;border-radius:12px;max-width:520px;width:100%;max-height:90vh;overflow:auto;">
      ${state.modal.content}
    </div>
  `;
  document.body.appendChild(overlay);
  state.modal.onMount?.();
}

function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.remove();
  state.modal = null;
}

function openSolicitudForm(detalle) {
  const isEdit = Boolean(detalle);
  const origenOptions = state.data.origenes
    .map((o) => `<option value="${o.id}" ${detalle && detalle.origen_id === o.id ? 'selected' : ''}>${o.nombre}</option>`)
    .join('');
  const motivoOptions = state.data.motivos
    .map((m) => `<option value="${m.id}" ${detalle && detalle.motivo_id === m.id ? 'selected' : ''}>${m.nombre}</option>`)
    .join('');
  state.modal = {
    content: `
      <h3>${isEdit ? t('acciones.editar') : t('solicitudes.nueva')}</h3>
      <form id="form-solicitud">
        <div class="form-field"><label>Job<input name="job" value="${detalle?.job || ''}" ${detalle && detalle.estado !== 'borrador' && state.user.rol !== 'admin' ? 'disabled' : ''} /></label></div>
        <div class="form-field"><label>ID Muestra<input name="id_muestra" value="${detalle?.id_muestra || ''}" ${detalle && detalle.estado !== 'borrador' && state.user.rol !== 'admin' ? 'disabled' : ''} /></label></div>
        <div class="form-field"><label>Analito<input name="analito" value="${detalle?.analito || ''}" ${detalle && detalle.estado !== 'borrador' && state.user.rol !== 'admin' ? 'disabled' : ''} /></label></div>
        <div class="form-field"><label>Origen<select name="origen_id">${origenOptions}</select></label></div>
        <div class="form-field"><label>Motivo<select name="motivo_id">${motivoOptions}</select></label></div>
        <div class="form-field"><label>${t('solicitud.observaciones')}<textarea name="observaciones" maxlength="2000">${detalle?.observaciones || ''}</textarea></label></div>
        <div class="actions" style="display:flex;gap:0.5rem;justify-content:flex-end;">
          <button type="button" class="secondary" id="btn-autocompletar">Autocompletar</button>
          <button type="button" class="secondary" id="cancelar-modal">${t('acciones.cancelar')}</button>
          <button type="submit">${t('acciones.guardar')}</button>
        </div>
      </form>
    `,
    onMount: () => {
      document.getElementById('cancelar-modal').addEventListener('click', closeModal);
      document.getElementById('btn-autocompletar').addEventListener('click', async () => {
        const form = document.getElementById('form-solicitud');
        const job = form.job.value;
        const id_muestra = form.id_muestra.value;
        const analito = form.analito.value;
        const data = await apiFetch(`/api/bdp?${new URLSearchParams({ job, id_muestra, analito }).toString()}`);
        if (data.length) {
          showToast('Datos sugeridos cargados');
        } else {
          showToast('Sin coincidencias', true);
        }
      });
      document.getElementById('form-solicitud').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const payload = {
          job: form.job.value.trim() || undefined,
          id_muestra: form.id_muestra.value.trim() || undefined,
          analito: form.analito.value.trim() || undefined,
          origen_id: Number(form.origen_id.value),
          motivo_id: Number(form.motivo_id.value),
          observaciones: form.observaciones.value.trim() || undefined
        };
        try {
          if (isEdit) {
            state.data.detalle = await apiFetch(`/api/solicitudes/${detalle.id}`, { method: 'PUT', body: payload });
          } else {
            const nueva = await apiFetch('/api/solicitudes', { method: 'POST', body: payload });
            state.data.detalle = nueva;
          }
          showToast(t('notificaciones.guardado'));
          closeModal();
          await loadSolicitudes(state.data.page, state.data.sort);
        } catch (error) {
          // handled
        }
      });
    }
  };
  renderModal();
}

function openCatalogoForm(type, item) {
  const isEdit = Boolean(item);
  state.modal = {
    content: `
      <h3>${isEdit ? t('acciones.editar') : t('catalogos.nuevo')} ${type}</h3>
      <form id="form-catalogo">
        <div class="form-field"><label>Nombre<input name="nombre" required maxlength="80" value="${item?.nombre || ''}" /></label></div>
        <div class="form-field"><label>Descripción<textarea name="descripcion" maxlength="240">${item?.descripcion || ''}</textarea></label></div>
        <div class="form-field"><label>Activo<select name="activo"><option value="true" ${item?.activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${item?.activo === false ? 'selected' : ''}>No</option></select></label></div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="secondary" id="cancelar-modal">${t('acciones.cancelar')}</button>
          <button type="submit">${t('acciones.guardar')}</button>
        </div>
      </form>
    `,
    onMount: () => {
      document.getElementById('cancelar-modal').addEventListener('click', closeModal);
      document.getElementById('form-catalogo').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const payload = {
          nombre: form.nombre.value.trim(),
          descripcion: form.descripcion.value.trim(),
          activo: form.activo.value === 'true'
        };
        try {
          if (isEdit) {
            await apiFetch(`/api/catalogos/${type === 'origen' ? 'origenes' : 'motivos'}/${item.id}`, {
              method: 'PUT',
              body: payload
            });
          } else {
            await apiFetch(`/api/catalogos/${type === 'origen' ? 'origenes' : 'motivos'}`, {
              method: 'POST',
              body: payload
            });
          }
          showToast(t('notificaciones.guardado'));
          closeModal();
          await loadBaseData();
          render();
        } catch (error) {
          // handled
        }
      });
    }
  };
  renderModal();
}

function openUsuarioForm(usuario) {
  const isEdit = Boolean(usuario);
  state.modal = {
    content: `
      <h3>${isEdit ? t('acciones.editar') : t('catalogos.nuevo')}</h3>
      <form id="form-usuario">
        <div class="form-field"><label>Nombre<input name="nombre" required value="${usuario?.nombre || ''}" /></label></div>
        <div class="form-field"><label>Email<input name="email" required type="email" value="${usuario?.email || ''}" /></label></div>
        <div class="form-field"><label>Rol<select name="rol"><option value="admin" ${usuario?.rol === 'admin' ? 'selected' : ''}>Admin</option><option value="usuario" ${usuario?.rol !== 'admin' ? 'selected' : ''}>Usuario</option></select></label></div>
        <div class="form-field"><label>Área<input name="area" value="${usuario?.area || ''}" /></label></div>
        <div class="form-field"><label>Activo<select name="activo"><option value="true" ${usuario?.activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${usuario?.activo === false ? 'selected' : ''}>No</option></select></label></div>
        ${isEdit ? '' : '<div class="form-field"><label>Credencial<input name="credencial" type="password" minlength="10" required /></label></div>'}
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="secondary" id="cancelar-modal">${t('acciones.cancelar')}</button>
          <button type="submit">${t('acciones.guardar')}</button>
        </div>
      </form>
    `,
    onMount: () => {
      document.getElementById('cancelar-modal').addEventListener('click', closeModal);
      document.getElementById('form-usuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const payload = {
          nombre: form.nombre.value.trim(),
          email: form.email.value.trim(),
          rol: form.rol.value,
          area: form.area.value.trim(),
          activo: form.activo.value === 'true'
        };
        try {
          if (isEdit) {
            await apiFetch(`/api/usuarios/${usuario.id}`, { method: 'PUT', body: payload });
          } else {
            payload.credencial = form.credencial.value.trim();
            await apiFetch('/api/usuarios', { method: 'POST', body: payload });
          }
          showToast(t('notificaciones.guardado'));
          closeModal();
          state.data.usuarios = await apiFetch('/api/usuarios');
          render();
        } catch (error) {
          // handled
        }
      });
    }
  };
  renderModal();
}

function drawCharts(data) {
  const estadoCanvas = document.getElementById('chart-estado');
  const origenCanvas = document.getElementById('chart-origen');
  const motivoCanvas = document.getElementById('chart-motivo');
  if (estadoCanvas) {
    const ctx = estadoCanvas.getContext('2d');
    const estados = data.estados;
    const width = estadoCanvas.width || estadoCanvas.clientWidth;
    const height = estadoCanvas.height || estadoCanvas.clientHeight;
    estadoCanvas.width = width;
    estadoCanvas.height = height;
    ctx.clearRect(0, 0, width, height);
    const max = Math.max(...estados.map((e) => e.total), 1);
    const barWidth = width / estados.length - 20;
    estados.forEach((item, index) => {
      const barHeight = (item.total / max) * (height - 40);
      const x = index * (barWidth + 20) + 20;
      const y = height - barHeight - 20;
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.fillStyle = '#1a202c';
      ctx.fillText(statusLabels[item.estado], x, height - 5);
    });
  }
  const drawPie = (canvas, list) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width || canvas.clientWidth;
    const height = canvas.height || canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    const total = list.reduce((acc, cur) => acc + cur.total, 0) || 1;
    let start = 0;
    list.forEach((item, index) => {
      const slice = (item.total / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2);
      ctx.fillStyle = `hsl(${(index * 60) % 360}, 70%, 60%)`;
      ctx.arc(width / 2, height / 2, Math.min(width, height) / 2 - 10, start, start + slice);
      ctx.closePath();
      ctx.fill();
      const mid = start + slice / 2;
      ctx.fillStyle = '#1a202c';
      ctx.fillText(item.label, width / 2 + Math.cos(mid) * (width / 4), height / 2 + Math.sin(mid) * (height / 4));
      start += slice;
    });
  };
  drawPie(origenCanvas, data.origenTop);
  drawPie(motivoCanvas, data.motivoTop);
}

function base64ToBlob(base64, type = 'application/octet-stream') {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type });
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleString();
}
