// ARSLAN — Módulo externo "Poner precios"
// Lee ?data=... (LZString) y permite marcar productos y asignarles precio nuevo

let PAYLOAD = null;
let ROWS = [];        // {id, group, groupLabel, name, old, value, checked}
let CURRENT_GROUP = 'ALL';

// Shortcuts de DOM
const $ = (id) => document.getElementById(id);

/* ========= UTILIDADES ========= */
function escapeHTML(str){
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

/* ========= CARGA PAYLOAD ========= */
function parsePayloadFromURL(){
  const qs = new URLSearchParams(location.search);
  const data = qs.get('data');
  if(!data) return null;
  try{
    const json = LZString.decompressFromEncodedURIComponent(data);
    if(!json) return null;
    return JSON.parse(json);
  }catch(err){
    console.error('Error parseando payload:', err);
    return null;
  }
}

function buildRowsFromPayload(){
  if(!PAYLOAD || !Array.isArray(PAYLOAD.groups)) return;
  ROWS = [];
  PAYLOAD.groups.forEach(group=>{
    const gid = group.id || 'GRP';
    const glabel = group.label || gid;
    (group.items || []).forEach((it, idx)=>{
      ROWS.push({
        id: `${gid}_${it.key || idx}`,
        group: gid,
        groupLabel: glabel,
        name: it.name || '',
        old: it.oldPrice || '',
        value: '',       // nuevo precio introducido aquí
        checked: false
      });
    });
  });
}

/* ========= FILTRADO ========= */
function filteredRows(){
  if(CURRENT_GROUP === 'ALL') return ROWS;
  return ROWS.filter(r => r.group === CURRENT_GROUP);
}

/* ========= RENDER SELECTOR GRUPO ========= */
function buildGroupSelector(){
  const sel = $('selGroup');
  if(!sel) return;

  const groups = new Map();
  ROWS.forEach(r => groups.set(r.group, r.groupLabel));

  let html = `<option value="ALL">Todos los grupos</option>`;
  Array.from(groups.entries()).forEach(([id,label])=>{
    html += `<option value="${id}">${escapeHTML(label)}</option>`;
  });
  sel.innerHTML = html;
  sel.value = CURRENT_GROUP;

  sel.onchange = () => {
    CURRENT_GROUP = sel.value;
    renderTable();
  };
}

/* ========= RENDER TABLA ========= */
function renderTable(){
  const tbody = $('tbody');
  const infoCount = $('infoCount');
  const totPreview = $('totPreview');
  const statsPreview = $('statsPreview');
  if(!tbody) return;

  const rows = filteredRows();
  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="4"><span class="hint">No hay productos en este grupo.</span></td></tr>`;
    if(infoCount) infoCount.textContent = '0 productos.';
    if(totPreview) totPreview.textContent = '';
    if(statsPreview) statsPreview.textContent = '';
    return;
  }

  let html = '';
  let countNew = 0;
  let sumPrices = 0;

  rows.forEach(r => {
    const hasNew = r.value !== '' && !isNaN(parseFloat(r.value.replace(',','.')));
    if(hasNew){
      countNew++;
      sumPrices += parseFloat(r.value.replace(',','.'));
    }
    html += `<tr data-id="${escapeHTML(r.id)}">
      <td>
        <input type="checkbox" class="chk-row" ${r.checked ? 'checked' : ''}>
      </td>
      <td class="name">
        ${escapeHTML(r.name)}
        <div class="hint">${escapeHTML(r.groupLabel || '')}</div>
      </td>
      <td class="old">${r.old ? escapeHTML(r.old) + ' €' : ''}</td>
      <td>
        <input
          class="price-input"
          inputmode="decimal"
          autocomplete="off"
          value="${r.value !== '' ? escapeHTML(r.value) : ''}"
        >
      </td>
    </tr>`;
  });

  tbody.innerHTML = html;

  if(infoCount) infoCount.textContent = `${rows.length} productos en este grupo.`;
  if(totPreview){
    totPreview.textContent = countNew > 0
      ? `Líneas con precio nuevo: ${countNew} — Suma de nuevos precios (solo vista rápida): ${sumPrices.toFixed(2)}€`
      : 'Sin precios nuevos todavía.';
  }
  if(statsPreview){
    const totalSelected = selectedRowsWithNewPrice().length;
    statsPreview.textContent = totalSelected
      ? `Seleccionadas para exportar: ${totalSelected} líneas.`
      : 'Ninguna línea seleccionada con precio nuevo.';
  }
}

/* ========= MANEJO DE EVENTOS EN LA TABLA ========= */
function setupTableEvents(){
  const tbody = $('tbody');
  if(!tbody) return;

  // Checkbox seleccionar fila
  tbody.addEventListener('change', (e)=>{
    if(!e.target.matches('.chk-row')) return;
    const tr = e.target.closest('tr');
    if(!tr) return;
    const id = tr.dataset.id;
    const row = ROWS.find(x => x.id === id);
    if(!row) return;
    row.checked = e.target.checked;
    renderTable(); // para actualizar stats
  });

  // Input precio: blur y enter
  tbody.addEventListener('blur', (e)=>{
    if(!e.target.matches('.price-input')) return;
    const tr = e.target.closest('tr');
    if(!tr) return;
    const id = tr.dataset.id;
    const row = ROWS.find(x => x.id === id);
    if(!row) return;
    handlePriceBlur(e.target, row);
  }, true);

  tbody.addEventListener('keydown', (e)=>{
    if(!e.target.matches('.price-input')) return;
    if(e.key === 'Enter'){
      e.preventDefault();
      // guardar valor actual antes de moverse
      const tr = e.target.closest('tr');
      if(tr){
        const id = tr.dataset.id;
        const row = ROWS.find(x => x.id === id);
        if(row) handlePriceBlur(e.target, row, /*noRerender*/true);
      }
      // saltar al siguiente input visible
      const all = Array.from(tbody.querySelectorAll('.price-input'));
      const idx = all.indexOf(e.target);
      if(idx > -1 && all[idx+1]){
        all[idx+1].focus();
        all[idx+1].select();
      }
    }
  });
}

function handlePriceBlur(input, row, noRerender){
  const raw = String(input.value || '').trim();
  if(raw === ''){
    row.value = '';
    if(!noRerender) renderTable();
    return;
  }
  const n = parseFloat(raw.replace(',','.'));
  if(isNaN(n)){
    // valor inválido → revertir
    input.value = row.value || '';
    return;
  }
  const fixed = n.toFixed(2);
  row.value = fixed;
  input.value = fixed;
  if(!noRerender) renderTable();
}

/* ========= SELECCIONAR TODO / NADA ========= */
function selectAllInCurrent(flag){
  filteredRows().forEach(r => { r.checked = !!flag; });
  renderTable();
}

/* ========= LÓGICA DE EXPORTACIÓN ========= */
function selectedRowsWithNewPrice(){
  return ROWS.filter(r=>{
    if(!r.checked) return false;
    if(!r.value) return false;
    const newN = parseFloat(r.value.replace(',','.'));
    if(isNaN(newN)) return false;
    // Si hay precio antiguo, ignorar si es exactamente igual
    if(r.old){
      const oldN = parseFloat(String(r.old).replace(',','.'));
      if(!isNaN(oldN) && Math.abs(oldN - newN) < 0.0001) return false;
    }
    return true;
  });
}

/* ========= EXPORT TXT ========= */
function exportTXT(){
  const rows = selectedRowsWithNewPrice();
  if(!rows.length){
    alert('No hay líneas seleccionadas con precio nuevo.');
    return;
  }
  const lines = rows.map(r => `${r.name}\t${r.value}€`);
  const today = new Date().toISOString().split('T')[0];
  const blob = new Blob([lines.join('\n')], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `precios_nuevos_${today}.txt`;
  a.click();
}

/* ========= EXPORT PDF (solo nombre + precio nuevo) ========= */
function generatePDF(){
  const rows = selectedRowsWithNewPrice();
  if(!rows.length){
    alert('No hay líneas seleccionadas con precio nuevo.');
    return;
  }
  const dt = new Date();
  const dateStr = dt.toLocaleDateString();
  const timeStr = dt.toLocaleTimeString();

  const rowsHTML = rows.map(r => `
    <tr>
      <td>${escapeHTML(r.name)}</td>
      <td style="text-align:right">${escapeHTML(r.value)}</td>
    </tr>
  `).join('');

  const w = window.open('', '_blank');
  if(!w){
    alert('El navegador ha bloqueado la ventana emergente. Permite pop-ups para guardar el PDF.');
    return;
  }

  w.document.open();
  w.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Nuevos precios</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body{font-family:Poppins,system-ui,Arial;margin:24px;color:#111827}
    h1{font-size:18px;margin:0 0 6px}
    .meta{font-size:12px;color:#6b7280;margin-bottom:14px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #11182722;padding:6px;vertical-align:top}
    th{text-transform:uppercase;letter-spacing:.04em;background:#11182710}
    @media print{ .noPrint{display:none} }
    .noPrint{margin-bottom:12px}
    button{padding:8px 12px;border-radius:10px;border:1px solid #11182722;background:#fff;cursor:pointer}
  </style>
</head>
<body>
  <div class="noPrint">
    <button onclick="window.print()">🧾 Imprimir / Guardar como PDF</button>
  </div>
  <h1>💶 Nuevos precios</h1>
  <div class="meta">${escapeHTML(dateStr)} — ${escapeHTML(timeStr)}</div>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th style="text-align:right">Nuevo precio</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML}
    </tbody>
  </table>
</body>
</html>`);
  w.document.close();
}

/* ========= INIT ========= */
function init(){
  const meta = $('metaInfo');

  PAYLOAD = parsePayloadFromURL();
  if(!PAYLOAD || !Array.isArray(PAYLOAD.groups) || !PAYLOAD.groups.length){
    if(meta) meta.textContent = 'Sin datos recibidos. Abre este link desde ARSLAN LISTAS (botón “💶 Link Precios”).';
    $('infoCount').textContent = '0 productos.';
    return;
  }

  if(meta){
    meta.textContent = `Fecha ARSLAN: ${PAYLOAD.dateISO || ''} — grupos: ${PAYLOAD.groups.length}`;
  }

  buildRowsFromPayload();
  buildGroupSelector();
  setupTableEvents();
  renderTable();

  // Botones globales
  const btnAll = $('btnAll');
  const btnNone = $('btnNone');
  const btnTXT = $('btnTXT');
  const btnPDF = $('btnPDF');

  if(btnAll) btnAll.onclick = () => selectAllInCurrent(true);
  if(btnNone) btnNone.onclick = () => selectAllInCurrent(false);
  if(btnTXT) btnTXT.onclick = exportTXT;
  if(btnPDF) btnPDF.onclick = generatePDF;
}

document.addEventListener('DOMContentLoaded', init);
