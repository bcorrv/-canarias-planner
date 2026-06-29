// V32-PLATFORM-MODULES
// Planner Firebase V29 modular - admin/documents/packing UI helpers
window.tripDocuments=[];
window.packingItems=[];

function renderTripDocuments(){
  const box=document.getElementById('documentsList'); if(!box)return;
  const q=(document.getElementById('docSearch')?.value||'').toLowerCase();
  const type=document.getElementById('docFilterType')?.value||'';
  const docs=(window.tripDocuments||[]).filter(d=>{
    const txt=[d.title,d.type,d.owner,d.notes,d.url,d.fileName,d.scope,d.status].join(' ').toLowerCase();
    return (!q||txt.includes(q)) && (!type||d.type===type);
  }).sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')));
  if(!docs.length){box.innerHTML='<div class="warn">Aún no hay documentos guardados para este viaje.</div>';return;}
  box.innerHTML=docs.map(d=>{
    const scope=d.scope||'trip';
    const cls=scope==='personal'?'doc-sensitive':'doc-trip';
    const status=d.status||'pending';
    const statusClass=status==='loaded'||status==='validated'?'status-loaded':(status==='expired'?'status-expired':'status-pending');
    const fileLabel=d.fileName?`<div class="doc-meta"><b>Archivo</b><br>${d.fileName}</div>`:'';
    const sizeLabel=d.fileSize?`<div class="doc-meta"><b>Tamaño</b><br>${Math.round(Number(d.fileSize||0)/1024)} KB</div>`:'';
    const dateLabel=d.date?`<div class="doc-meta"><b>Fecha</b><br>${d.date}</div>`:'';
    return `<article class="doc-card ${cls}"><h4>${d.title||'Documento'}</h4><span class="doc-type-pill">${scope==='personal'?'Personal sensible':'Viaje'}</span><span class="doc-type-pill">${d.type||'otro'}</span><span class="doc-type-pill">${d.owner||'Todos'}</span><span class="status-pill ${statusClass}">${status}</span><div class="doc-meta-grid">${fileLabel}${sizeLabel}${dateLabel}</div><p class="mini">${d.notes||''}</p><div class="admin-actions">${d.downloadUrl?`<a target="_blank" href="${d.downloadUrl}">Abrir archivo</a>`:''}${d.url?`<a target="_blank" href="${d.url}">Abrir link</a>`:''}<button onclick="tripEditDocument('${d.id}')">Editar</button><button onclick="tripMarkDocument('${d.id}','validated')">Validar</button><button onclick="tripDeleteDocument('${d.id}','${scope}')">Eliminar</button></div></article>`;
  }).join('');
}
function renderPackingList(){
  const box=document.getElementById('packingList'); if(!box)return;
  const q=(document.getElementById('packingSearch')?.value||'').toLowerCase();
  const filter=document.getElementById('packingFilter')?.value||'';
  const items=(window.packingItems||[]).filter(i=>{
    const txt=[i.name,i.category,i.notes,i.owner].join(' ').toLowerCase();
    return (!q||txt.includes(q)) && (!filter||i.category===filter);
  }).sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''),'es') || String(a.name||'').localeCompare(String(b.name||''),'es'));
  if(!items.length){box.innerHTML='<div class="warn">Aún no hay checklist de maleta. Genera una recomendación base o agrega ítems manuales.</div>'; updatePackingSummary(); return;}
  const cats=[...new Set(items.map(i=>i.category||'otros'))];
  box.innerHTML=cats.map(cat=>{
    const arr=items.filter(i=>(i.category||'otros')===cat);
    const done=arr.filter(i=>i.packed).length;
    return `<section class="packing-category"><h4><span>${cat}</span><span class="mini">${done}/${arr.length}</span></h4>${arr.map(i=>`<div class="pack-item-row ${i.recommended?'pack-reco':''}"><input type="checkbox" ${i.packed?'checked':''} onchange="tripTogglePackingItem('${i.id}',this.checked)"><div><strong>${i.name}</strong><br><span class="mini">${i.notes||''}</span></div><div class="pack-qty">${i.qty||1}</div><div class="pack-owner">${i.owner||'Todos'}</div></div><div class="pack-actions"><button class="secondary" onclick="tripEditPackingItem('${i.id}')">Editar</button><button class="secondary" onclick="tripDeletePackingItem('${i.id}')">Eliminar</button></div>`).join('')}</section>`;
  }).join('');
  updatePackingSummary();
}
function updatePackingSummary(){
  const box=document.getElementById('packingSummary'); if(!box)return;
  const total=(window.packingItems||[]).length;
  const done=(window.packingItems||[]).filter(i=>i.packed).length;
  const docs=(window.packingItems||[]).filter(i=>i.category==='documentos').length;
  const trip=window.currentTripData||{};
  box.innerHTML=`<strong>${done}/${total}</strong> preparados<br><span class="mini">Viaje: ${trip.title||'—'} · Documentos críticos: ${docs}</span>`;
}
function packingBaseItems(trip={}, climate='templado', luggage='maleta'){
  const locs=(trip.locations||[trip.destination||trip.title||'']).join(' ').toLowerCase();
  const days=Math.max(1, Math.round(((trip.endDate&&trip.startDate)?((new Date(trip.endDate)-new Date(trip.startDate))/(86400000)+1):7)));
  const style=(trip.style||'balanceado').toLowerCase();
  const isBeach=climate==='playa'||locs.includes('playa')||style.includes('playa');
  const isTrekking=climate==='trekking'||style.includes('trekking')||style.includes('naturaleza');
  const isRain=climate==='lluvia';
  const isCold=climate==='frio';
  const base=[
    ['documentos','Pasaporte / cédula vigente',1,'Documento indispensable',true],
    ['documentos','Seguro de viaje',1,'Guardar póliza y teléfono de emergencia',true],
    ['documentos','Reservas de vuelos y hoteles',1,'Ideal tener copia offline',true],
    ['documentos','Tarjetas y efectivo básico',1,'Separar una tarjeta de respaldo',true],
    ['viaje','Cargador de celular',1,'Llevar en equipaje de mano',true],
    ['viaje','Adaptador universal',1,'Revisar enchufe del destino',true],
    ['viaje','Botella reutilizable',1,'Útil para caminatas y aeropuertos',true],
    ['ropa','Ropa interior',Math.min(days+2,14),'Cantidad ajustable por lavado',true],
    ['ropa','Poleras / camisas',Math.min(days,10),'Capas según clima',true],
    ['ropa','Pantalones / shorts',Math.ceil(days/3),'Combinar según actividades',true],
    ['calzado','Zapatillas cómodas',1,'Prioridad para caminar',true],
    ['higiene','Cepillo y pasta dental',1,'Kit básico',true],
    ['higiene','Protector solar',1,'Incluso en clima templado',true],
    ['salud','Medicamentos personales',1,'Con receta si aplica',true],
    ['tecnologia','Power bank',1,'Muy útil en días largos',true]
  ];
  if(isBeach) base.push(['playa','Traje de baño',2,'Para playa/piscina',true],['playa','Toalla liviana',1,'Microfibra ideal',true],['playa','Sandalias',1,'Playa y descanso',true],['playa','Lentes de sol',1,'Protección UV',true]);
  if(isTrekking) base.push(['trekking','Cortaviento / primera capa',1,'Para cambios de clima',true],['trekking','Mochila de día',1,'Agua, snacks y abrigo',true],['trekking','Bastones o soporte',1,'Opcional según rutas',true],['trekking','Calcetines técnicos',Math.min(days,6),'Evita ampollas',true]);
  if(isRain) base.push(['ropa','Chaqueta impermeable',1,'Clima variable',true],['otros','Bolsa seca o ziploc',2,'Proteger documentos/electrónica',true]);
  if(isCold) base.push(['ropa','Abrigo térmico',1,'Capas',true],['ropa','Gorro / guantes',1,'Según temperatura',true]);
  if(luggage==='mochila') base.push(['otros','Candado pequeño',1,'Hostales/transporte',true],['otros','Bolsas organizadoras',3,'Comprimir ropa',true]);
  return base.map(x=>({category:x[0],name:x[1],qty:x[2],notes:x[3],recommended:x[4],owner:'Todos',packed:false}));
}
window.renderTripDocuments=renderTripDocuments;
window.renderPackingList=renderPackingList;
window.updatePackingSummary=updatePackingSummary;
window.packingBaseItems=packingBaseItems;

function adminShowSection(id){
  document.querySelectorAll('.admin-nav button').forEach(b=>b.classList.toggle('active', b.dataset.adminSection===id));
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.toggle('active', s.id===id));
}
document.addEventListener('click', (e)=>{
  const btn=e.target.closest('.admin-nav button');
  if(btn) adminShowSection(btn.dataset.adminSection);
});
window.adminCache={users:[],trips:[],backlog:[]};
function adminRenderShell(){
  document.querySelectorAll('.admin-only').forEach(el=>el.style.display = window.isPlatformAdmin ? '' : 'none');
}
function adminRenderUsers(){
  const q=(document.getElementById('adminUserSearch')?.value||'').toLowerCase();
  const rows=(window.adminCache.users||[]).filter(u=>!q||[u.email,u.displayName,u.globalRole,u.status].join(' ').toLowerCase().includes(q));
  const tb=document.getElementById('adminUsersTable'); if(!tb)return;
  tb.innerHTML=rows.map(u=>`<tr><td>${u.email||''}</td><td>${u.displayName||''}</td><td>${u.globalRole||'user'}</td><td>${u.status||'active'}</td><td><div class="admin-actions"><button onclick="adminChangeGlobalRole('${u.uid}','${u.email||''}')">Rol</button><button onclick="adminToggleUserStatus('${u.uid}','${u.status||'active'}')">${(u.status||'active')==='disabled'?'Activar':'Bloquear'}</button></div></td></tr>`).join('');
}
function adminRenderTrips(){
  const tb=document.getElementById('adminTripsTable'); if(!tb)return;
  tb.innerHTML=(window.adminCache.trips||[]).map(t=>`<tr><td><strong>${t.title||t.id}</strong><br><span class="mini">${t.id}</span></td><td>${t.ownerEmail||''}</td><td>${(t.locations||[]).join(', ')||t.destination||''}</td><td>${(t.allowedEmails||[]).length}</td><td>${t.status||'active'}</td><td><div class="admin-actions"><button onclick="adminOpenTrip('${t.id}')">Abrir</button><button onclick="adminArchiveTrip('${t.id}','${t.status||'active'}')">${(t.status||'active')==='archived'?'Reactivar':'Archivar'}</button><button onclick="adminDeleteTrip('${t.id}')">Eliminar</button></div></td></tr>`).join('');
  const sel=document.getElementById('assignTrip');
  if(sel) sel.innerHTML=(window.adminCache.trips||[]).map(t=>`<option value="${t.id}">${t.title||t.id}</option>`).join('');
}
function adminRenderBacklog(){
  const box=document.getElementById('adminBacklogList'); if(!box)return;
  const items=(window.adminCache.backlog||[]).sort((a,b)=>(b.createdAtMs||0)-(a.createdAtMs||0));
  box.innerHTML=items.map(i=>`<article class="backlog-card"><h4>${i.title}</h4><div class="mini"><span class="priority-${i.priority}">${i.priority}</span> · ${i.type} · ${i.status} · ${i.createdBy||''}</div><p>${i.description||''}</p><div class="admin-actions"><button onclick="adminUpdateBacklogStatus('${i.id}','analysis')">Análisis</button><button onclick="adminUpdateBacklogStatus('${i.id}','doing')">Doing</button><button onclick="adminUpdateBacklogStatus('${i.id}','done')">Done</button><button onclick="adminDeleteBacklogItem('${i.id}')">Eliminar</button></div></article>`).join('') || '<div class="warn">Sin backlog cargado.</div>';
}
function adminRenderAll(){
  adminRenderShell();
  adminRenderUsers();
  adminRenderTrips();
  adminRenderBacklog();
  const u=document.getElementById('adminUsersCount'); if(u)u.textContent=(window.adminCache.users||[]).length;
  const t=document.getElementById('adminTripsCount'); if(t)t.textContent=(window.adminCache.trips||[]).length;
  const b=document.getElementById('adminBacklogOpen'); if(b)b.textContent=(window.adminCache.backlog||[]).filter(x=>!['done','discarded'].includes(x.status)).length;
  const lu=document.getElementById('adminLastUpdate'); if(lu)lu.textContent=new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
  const ov=document.getElementById('adminOverviewBox'); if(ov)ov.innerHTML=`<b>Estado plataforma</b><br><span class="mini">Usuarios: ${(window.adminCache.users||[]).length} · Viajes: ${(window.adminCache.trips||[]).length} · Backlog: ${(window.adminCache.backlog||[]).length}</span><br><span class="mini">Admin activo: ${window.currentUser?.email||''}</span>`;
}
window.adminShowSection=adminShowSection;window.adminRenderUsers=adminRenderUsers;window.adminRenderTrips=adminRenderTrips;window.adminRenderBacklog=adminRenderBacklog;window.adminRenderAll=adminRenderAll;

function openTripWizard(prefill={}){
  const m=document.getElementById('tripWizard');
  if(!m)return;
  document.getElementById('twTitle').value=prefill.title||'';
  document.getElementById('twStart').value=prefill.startDate||'';
  document.getElementById('twEnd').value=prefill.endDate||'';
  document.getElementById('twLocations').value=(prefill.locations||[]).join ? (prefill.locations||[]).join('\n') : (prefill.locations||'');
  document.getElementById('twStyle').value=prefill.style||'balanceado';
  document.getElementById('twPace').value=prefill.pace||'balanceado';
  document.getElementById('twBudget').value=prefill.budgetTarget||'';
  document.getElementById('twMembers').value=(prefill.memberEmails||[]).join ? (prefill.memberEmails||[]).join(', ') : (prefill.memberEmails||'');
  document.getElementById('twNotes').value=prefill.notes||'';
  m.style.display='flex';
}
function closeTripWizard(){const m=document.getElementById('tripWizard');if(m)m.style.display='none';}
function parseTripWizard(){
  return {
    title:document.getElementById('twTitle').value.trim(),
    startDate:document.getElementById('twStart').value,
    endDate:document.getElementById('twEnd').value,
    locations:document.getElementById('twLocations').value.split(/\n|,/).map(x=>x.trim()).filter(Boolean),
    style:document.getElementById('twStyle').value,
    pace:document.getElementById('twPace').value,
    budgetTarget:document.getElementById('twBudget').value.trim(),
    memberEmails:document.getElementById('twMembers').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),
    notes:document.getElementById('twNotes').value.trim()
  };
}
function deepSearchUrl(q){return 'https://www.google.com/search?q='+encodeURIComponent(q);}
function deepImageUrl(q){return 'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(q);}
function makeRecommendationCards(location, tripMeta={}){
  const style=tripMeta.style||'balanceado';
  const base=location;
  return [
    {kind:'Top lugares', title:`Qué ver en ${base}`, q:`${base} mejores lugares que ver guía viaje ${style}`},
    {kind:'Tripadvisor', title:`Tripadvisor ${base}`, q:`site:tripadvisor.com ${base} things to do attractions`},
    {kind:'Viajeros', title:`Experiencias reales ${base}`, q:`${base} blog viaje experiencia itinerario recomendaciones`},
    {kind:'Reddit', title:`Opiniones viajeros ${base}`, q:`site:reddit.com/r/travel ${base} itinerary recommendations`},
    {kind:'YouTube', title:`Vlogs ${base}`, q:`site:youtube.com ${base} travel vlog itinerary`},
    {kind:'Comida', title:`Restaurantes ${base}`, q:`${base} mejores restaurantes locales comida típica`},
    {kind:'Naturaleza', title:`Trekking/playas ${base}`, q:`${base} trekking playas miradores naturaleza guía`},
    {kind:'Mapa', title:`Explorar mapa ${base}`, q:`${base} attractions map`}
  ].map(x=>({...x, img:`https://tse1.mm.bing.net/th?q=${encodeURIComponent(x.q+' fotos viaje')}&w=480&h=270&c=7&rs=1&p=0`}));
}
function renderRecommendations(){
  const grid=document.getElementById('recommendationsGrid');
  if(!grid)return;
  const trip=window.currentTripData||{};
  const locations=(trip.locations&&trip.locations.length?trip.locations:[trip.destination, trip.title]).filter(Boolean);
  const unique=[...new Set(locations)];
  if(!unique.length){grid.innerHTML='<div class="warn">Este viaje aún no tiene ubicaciones. Crea o edita el viaje para generar recomendaciones.</div>';return;}
  let html='';
  unique.forEach(loc=>{
    makeRecommendationCards(loc, trip).forEach(card=>{
      const safeLoc=String(loc).replaceAll("'","\\'");
      const safeTitle=String(card.title).replaceAll("'","\\'");
      const safeQ=String(card.q).replaceAll("'","\\'");
      html += `<article class="rec-card"><div class="rec-photo" style="background-image:url('${card.img}')"></div><span class="role-pill">${card.kind}</span><strong>${card.title}</strong><p class="mini">${card.q}</p><div class="rec-actions"><a target="_blank" href="${deepSearchUrl(card.q)}">Buscar web</a><a target="_blank" href="${deepImageUrl(card.q+' fotos')}">Imágenes</a><button onclick="addHighlightFromSearch('${safeLoc}','${safeTitle}','${safeQ}')">Marcar highlight</button></div></article>`;
    });
  });
  grid.innerHTML=html;
}
function addHighlightFromSearch(location,title,query){
  if(!window.firebaseAddHighlight){alert('Firebase aún no está listo.');return;}
  window.firebaseAddHighlight({location,title,query,createdAt:new Date().toISOString()});
}
function updateTripMetaPanel(){
  const box=document.getElementById('tripMetaPanel');
  if(!box)return;
  const t=window.currentTripData||{};
  box.innerHTML=`<b>${t.title||'Viaje sin nombre'}</b><br>
  <span class="mini">Fechas: ${t.startDate||'—'} → ${t.endDate||'—'} · Estilo: ${t.style||'—'} · Ritmo: ${t.pace||'—'} · Presupuesto: ${t.budgetTarget||'—'}</span><br>
  <span class="mini">Ubicaciones: ${(t.locations||[]).join(', ')||t.destination||'—'}</span>`;
}
function renderUsersPanel(){
  const grid=document.getElementById('usersGrid');
  if(!grid)return;
  const trip=window.currentTripData||{};
  const roles=trip.rolesByEmail||{};
  const emails=Object.keys(roles).sort();
  if(!emails.length){grid.innerHTML='<div class="warn">No hay usuarios cargados para este viaje.</div>';return;}
  grid.innerHTML=emails.map(email=>`<article class="user-card"><strong>${email}</strong><span class="role-pill">${roles[email]}</span><div class="user-actions"><button onclick="firebaseChangeRolePrompt && firebaseChangeRolePrompt('${email}')">Cambiar rol</button><button onclick="firebaseRemoveMember && firebaseRemoveMember('${email}')">Quitar</button></div></article>`).join('');
}
window.openTripWizard=openTripWizard;window.closeTripWizard=closeTripWizard;window.parseTripWizard=parseTripWizard;window.renderRecommendations=renderRecommendations;window.renderUsersPanel=renderUsersPanel;window.updateTripMetaPanel=updateTripMetaPanel;

function renderTripZone(){
  if(!window.currentTripData || typeof tripZoneLayer==='undefined') return;
  tripZoneLayer.clearLayers();
  const t=window.currentTripData;
  const zones=t.mapZones||[];
  if(!zones.length && t.mapCenter) zones.push(t.mapCenter);
  const latlngs=[];
  zones.forEach((z,idx)=>{
    if(z&&z.lat&&z.lon){
      latlngs.push([z.lat,z.lon]);
      L.circle([z.lat,z.lon],{radius:25000,color:'#0891b2',weight:2,fillColor:'#67e8f9',fillOpacity:.08}).bindPopup(`<strong>Zona ${idx+1}</strong><br>${z.label||z.query||t.title||''}`).addTo(tripZoneLayer);
      L.marker([z.lat,z.lon]).bindPopup(`<strong>${z.query||z.label||'Zona del viaje'}</strong>`).addTo(tripZoneLayer);
    }
  });
  if(latlngs.length){ try{ map.fitBounds(L.latLngBounds(latlngs).pad(.45),{maxZoom:8}); }catch(e){} }
}
function renderLiveRouteBase(){
  const box=document.getElementById('liveRouteBase');
  if(!box)return;
  const trip=window.currentTripData||{};
  const plan=(window.itineraryPlan||[]).map((e,idx)=>({e,idx,p:(window.getItem?getItem(e.uid):(byId[e.uid]||customPoints.find(x=>x.uid===e.uid)))})).filter(x=>x.p);
  const zones=(trip.locations||[]).map(x=>`<span class="zone-pill">${x}</span>`).join('');
  if(!plan.length){
    box.innerHTML=`<strong>Hoja de ruta base</strong><br><span class="mini">Viaje: ${trip.title||'—'} · Zonas: ${zones||trip.destination||'—'}</span><br><span class="mini">Agrega puntos al itinerario para construir la ruta completa. Para Canarias se mantiene además la ruta precargada con hoteles, transporte, entradas y restaurantes.</span>`;
    return;
  }
  const days=[...new Set(plan.map(x=>x.e.day||'Sin día'))].sort((a,b)=>String(a).localeCompare(String(b),'es'));
  let html=`<strong>Hoja de ruta viva</strong><br><span class="mini">Zonas: ${zones||trip.destination||'—'}</span>`;
  days.forEach(day=>{
    const arr=plan.filter(x=>(x.e.day||'Sin día')===day);
    html+=`<div class="route-day-card"><h4>${day}</h4>`;
    html+=`<div class="route-step"><span class="route-badge">Salida</span><div>Base/hotel definido para el día o punto de partida del mapa. Ajustar hotel en notas del día.</div></div>`;
    arr.forEach((x,i)=>{
      const p=x.p;
      html+=`<div class="route-step"><span class="route-badge">${i+1}</span><div><strong>${p.name}</strong><br><span class="mini">${p.area||''} · ${p.cat||''} · ${p.schedule||p.hours||''}</span><br><span class="mini"><b>Costo/entrada:</b> ${p.price||p.costHtml||'Por definir'} · <b>Traslado:</b> desde punto anterior/base según optimizador.</span></div></div>`;
    });
    html+=`<div class="route-step"><span class="route-badge">Cierre</span><div>Regreso a base/hotel o traslado al siguiente destino. Revisar tiempos y reservas de transporte.</div></div></div>`;
  });
  box.innerHTML=html;
}
window.renderTripZone=renderTripZone;window.renderLiveRouteBase=renderLiveRouteBase;


function exportTripDocumentsCSV(){
  const rows=[['scope','type','status','title','owner','date','fileName','url','downloadUrl','notes']];
  (window.tripDocuments||[]).forEach(d=>rows.push([d.scope||'trip',d.type||'',d.status||'',d.title||'',d.owner||'',d.date||'',d.fileName||'',d.url||'',d.downloadUrl||'',d.notes||'']));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='travel-planner-documentos.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
function requiredDocumentsForTrip(){
  const trip=window.currentTripData||{};
  const locs=(trip.locations||[]).join(' ').toLowerCase();
  const base=[
    {title:'Pasaporte / cédula vigente',type:'pasaporte',owner:'Cada viajero',notes:'Verificar vigencia antes de comprar vuelos.'},
    {title:'Seguro de viaje',type:'seguro',owner:'Cada viajero',notes:'Guardar póliza, teléfono de emergencia y cobertura.'},
    {title:'Reservas de vuelos',type:'vuelo',owner:'Todos',notes:'Código de reserva, horarios y equipaje incluido.'},
    {title:'Reservas de hoteles',type:'hotel',owner:'Todos',notes:'Dirección, check-in, cancelación y contacto.'},
    {title:'Medio de pago principal y respaldo',type:'otro',owner:'Cada viajero',notes:'Tarjeta principal, tarjeta backup y efectivo básico.'},
    {title:'Contactos de emergencia',type:'otro',owner:'Todos',notes:'Emergencias, asistencia, embajada/consulado si aplica.'}
  ];
  if(locs.includes('canarias')||locs.includes('tenerife')||locs.includes('lanzarote')||locs.includes('graciosa')){
    base.push({title:'Ferries / transporte entre islas',type:'auto',owner:'Todos',notes:'Tickets, horarios y condiciones de cambios.'});
    base.push({title:'Reserva auto / licencia conducir',type:'auto',owner:'Conductor',notes:'Licencia, tarjeta de crédito y seguro del auto.'});
  }
  return base;
}
window.exportTripDocumentsCSV=exportTripDocumentsCSV;
window.requiredDocumentsForTrip=requiredDocumentsForTrip;
