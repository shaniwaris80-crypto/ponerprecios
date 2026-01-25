// app.js — Poner precios externo (mobile friendly)

let items = [];        // {key,name,provider,price}
let flatInputs = [];   // lista plana de inputs para navegar con Enter

const KNOWN_PROV = ["ESMO","MONTENEGRO","ÁNGEL VACA","JOSÉ ANTONIO","JAVI","ANGELO","NO ASIGNADO"];

function getQueryParam(name){
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function parsePayload(){
  const packed = getQueryParam('data');
  if(!packed) return null;
  try{
    const json = LZString.decompressFromEncodedURIComponent(packed);
    if(!json) return null;
    const obj = JSON.parse(json);
    if(!obj || !Array.isArray(obj.items)) return null;
    return obj;
  }catch(e){
    console.error(e);
    return null;
  }
}

function groupItemsByProvider(list){
  const groups = {};
  list.forEach(it=>{
    const prov = (it.provider || 'NO ASIGNADO').toUpperCase();
    if(!groups[prov]) groups[prov] = [];
    groups[prov].push(it);
  });
  const orderedProvs = [];
  KNOWN_PROV.forEach(p=>{
    if(groups[p] && groups[p].length) orderedProvs.push(p);
  });
  Object.keys(groups).forEach(p=>{
    if(!orderedProvs.includes(p)) orderedProvs.push(p);
  });
  const final = [];
  orderedProvs.forEach(p=>{
    final.push({ provider:p, items: groups[p].sort((a,b)=>a.name.localeCompare(b.name,'es')) });
  });
  return final;
}

function render(payload){
  items = (payload.items || []).map(it=>({
    key: String(it.key || ''),
    name: String(it.name || ''),
    provider: String(it.provider || 'NO ASIGNADO').toUpperCase(),
    price: it.price ? String(it.price) : ''
  }));
  const content = document.getElementById('content');
  const metaInfo = document.getElementById('metaInfo');
  const countProducts = document.getElementById('countProducts');
  const countWithPrice = document.getElementById('countWithPrice');

  if(!items.length){
    content.innerHTML = `<div class="card"><div class="card-bd">
      <div class="hint">No se han recibido productos. Asegúrate de abrir este enlace desde ARSLAN LISTAS con el botón "💶 Link Precios".</div>
    </div></div>`;
    countProducts.textContent = '0 productos';
    countWithPrice.textContent = '0 con precio';
    metaInfo.textContent = '';
    return;
  }

  metaInfo.textContent = payload.dateISO ? `Fecha: ${payload.dateISO}` : '';
  countProducts.textContent = `${items.length} productos`;
  countWithPrice.textContent = `${items.filter(i=>i.price && i.price!=='').length} con precio`;

  const groups = groupItemsByProvider(items);
  let html = '';

  groups.forEach(group=>{
    html += `
      <div class="card">
        <div class="card-hd">
          <div class="prov-title">
            <span>${group.provider === 'NO ASIGNADO' ? '🔘 Sin proveedor asignado' : '🏷️ ' + group.provider}</span>
            <span class="prov-badge">${group.items.length} productos</span>
          </div>
        </div>
        <div class="card-bd">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th style="width:90px;text-align:right">Precio</th>
              </tr>
            </thead>
            <tbody>
    `;
    group.items.forEach((it)=>{
      const index = items.findIndex(x=>x.key===it.key);
      html += `
        <tr>
          <td class="row-header">${escapeHTML(it.name)}</td>
          <td style="text-align:right">
            <input
              type="text"
              inputmode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              class="price-input"
              data-index="${index}"
              value="${it.price ? escapeHTML(it.price) : ''}"
              placeholder="0,00">
          </td>
        </tr>
      `;
    });
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  content.innerHTML = html;

  flatInputs = Array.from(document.querySelectorAll('.price-input'));
  flatInputs.forEach((inp, idx)=>{
    inp.addEventListener('keydown',(e)=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        const next = flatInputs[idx+1];
        if(next){ next.focus(); next.select?.(); }
      }
    });
    inp.addEventListener('blur',()=>{
      const index = Number(inp.dataset.index);
      savePriceFromInput(index, inp);
      updateCounters();
    });
  });
}

function savePriceFromInput(index, input){
  if(!items[index]) return;
  const raw = (input.value || '').trim();
  if(raw === ''){
    items[index].price = '';
    input.value = '';
    return;
  }
  const n = parseFloat(raw.replace(',','.'));
  if(isNaN(n)){
    input.value = items[index].price || '';
    return;
  }
  const val = n.toFixed(2);
  items[index].price = val;
  input.value = val;
}

function updateCounters(){
  const countProducts = document.getElementById('countProducts');
  const countWithPrice = document.getElementById('countWithPrice');
  countProducts.textContent = `${items.length} productos`;
  countWithPrice.textContent = `${items.filter(i=>i.price && i.price!=='').length} con precio`;
}

function escapeHTML(str){
  return String(str||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

/* ==========================
   Export PDF precios (solo con precio)
========================== */
function exportPreciosPDF(){
  const withPrice = items.filter(it=>it.price && it.price!=='');
  if(!withPrice.length){
    alert('No hay productos con precio. Introduce al menos un precio.');
    return;
  }
  const dt = new Date();
  const dateStr = dt.toLocaleDateString();
  const timeStr = dt.toLocaleTimeString();
  const rows = withPrice.sort((a,b)=>{
    const pa = a.provider === 'NO ASIGNADO' ? 'ZZZ' : a.provider;
    const pb = b.provider === 'NO ASIGNADO' ? 'ZZZ' : b.provider;
    if(pa === pb) return a.name.localeCompare(b.name,'es');
    return pa.localeCompare(pb,'es');
  });

  const rowsHTML = rows.map(it=>{
    return `<tr>
      <td>${escapeHTML(it.name)}</td>
      <td style="text-align:right">${escapeHTML(Number(it.price).toFixed(2))}€</td>
    </tr>`;
  }).join('');

  const w = window.open('', '_blank');
  if(!w){ alert('Popup bloqueado. Permite ventanas emergentes.'); return; }

  w.document.open();
  w.document.write(`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Precios ARSLAN</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
      <style>
        body{font-family:Poppins,system-ui,Arial;margin:24px;color:#111827}
        h1{font-size:18px;margin:0 0 6px}
        .meta{font-size:12px;color:#6b7280;margin-bottom:14px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #11182722;padding:6px;vertical-align:top}
        th{text-transform:uppercase;letter-spacing:.04em;background:#11182710;text-align:left}
        .noPrint{margin-bottom:12px}
        button{padding:8px 12px;border-radius:10px;border:1px solid #11182733;background:#fff;cursor:pointer}
        @media print{ .noPrint{display:none} }
      </style>
    </head>
    <body>
      <div class="noPrint">
        <button onclick="window.print()">🧾 Imprimir / Guardar como PDF</button>
      </div>
      <h1>💶 Lista de precios ARSLAN</h1>
      <div class="meta">${escapeHTML(dateStr)} — ${escapeHTML(timeStr)}</div>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th style="text-align:right">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
    </body>
    </html>
  `);
  w.document.close();
}

/* ==========================
   Copiar lista TXT (solo con precio)
========================== */
function copyListaTXT(){
  const withPrice = items.filter(it=>it.price && it.price!=='');
  if(!withPrice.length){
    alert('No hay productos con precio.');
    return;
  }
  const lines = withPrice
    .sort((a,b)=>a.name.localeCompare(b.name,'es'))
    .map(it=>`${it.name}\t${Number(it.price).toFixed(2)}€`);
  navigator.clipboard.writeText(lines.join('\n'))
    .then(()=>alert('Lista copiada al portapapeles.'))
    .catch(()=>alert('No se pudo copiar. Comprueba permisos del navegador.'));
}

/* ==========================
   INIT
========================== */
(function init(){
  const payload = parsePayload();
  if(!payload){
    render({items:[]});
    return;
  }
  render(payload);
})();
