// Planner Firebase V29 modular - Firebase Auth/Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { initializeFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs, collection, query, where, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  "apiKey": "AIzaSyD35W8eEb5F7E-1JmwowTsdfgO7RMz1DvY",
  "authDomain": "planner-22b96.firebaseapp.com",
  "projectId": "planner-22b96",
  "storageBucket": "planner-22b96.firebasestorage.app",
  "messagingSenderId": "450488147512",
  "appId": "1:450488147512:web:3c27d604d54bbc19ff90cd",
  "measurementId": "G-T0Z3XTGHN7"
};
const OWNER_EMAIL = "bo.cverdugo@gmail.com";
const INITIAL_PARTICIPANT = "javiera.sarracinav@gmail.com";
const INITIAL_TRIP_NAME = "Canarias 2028";
const INITIAL_TRIP_ID = "canarias-2028";
const ALLOWED_EMAILS = [OWNER_EMAIL, INITIAL_PARTICIPANT].map(x=>x.toLowerCase());

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false
});
const provider = new GoogleAuthProvider();

let unsubscribeTrip = null;
let unsubscribeTrips = null;
let unsubscribeCustomPoints = null;
let unsubscribeItinerary = null;
let unsubscribeNotes = null;
let unsubscribeHighlights = null;
let unsubscribeDocuments = null;
let unsubscribePacking = null;
let applyingRemote = false;
const PLATFORM_ADMINS = ['bo.cverdugo@gmail.com'];

const $ = (id) => document.getElementById(id);
function setSync(msg, ok=true){
  const el=$("syncStatus");
  if(el) {
    el.textContent = msg;
    el.style.background = ok ? "#f0fdf4" : "#fff7ed";
    el.style.color = ok ? "#166534" : "#9a3412";
    el.style.borderColor = ok ? "#bbf7d0" : "#fed7aa";
  }
}
function safeEmail(email){ return String(email||"").toLowerCase().trim(); }

async function ensureUser(user){
  await setDoc(doc(db, "users", user.uid), {
    uid:user.uid,
    email:safeEmail(user.email),
    displayName:user.displayName || "",
    photoURL:user.photoURL || "",
    updatedAt:serverTimestamp()
  }, {merge:true});
}

async function ensureInitialTrip(user){
  const tripRef = doc(db, "trips", INITIAL_TRIP_ID);
  const snap = await getDoc(tripRef);
  if(!snap.exists()){
    await setDoc(tripRef, {
      title: INITIAL_TRIP_NAME,
      destination: "Islas Canarias",
      ownerUid: user.uid,
      ownerEmail: safeEmail(user.email),
      allowedEmails: ALLOWED_EMAILS,
      rolesByEmail: {
        [OWNER_EMAIL]: "owner",
        [INITIAL_PARTICIPANT]: "editor"
      },
      state: window.getPlannerState ? window.getPlannerState() : {itineraryPlan:[],plannerNotes:{},customPoints:[],selectedPlan:[]},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: safeEmail(user.email)
    }, {merge:true});
  } else {
    const data=snap.data();
    if(data.ownerEmail===safeEmail(user.email)){
      await updateDoc(tripRef, {
        allowedEmails: arrayUnion(...ALLOWED_EMAILS),
        [`rolesByEmail.${OWNER_EMAIL}`]: "owner",
        [`rolesByEmail.${INITIAL_PARTICIPANT}`]: "editor",
        updatedAt: serverTimestamp()
      });
    }
  }
}

function listenTrips(user){
  if(unsubscribeTrips) unsubscribeTrips();
  const q = query(collection(db, "trips"), where("allowedEmails", "array-contains", safeEmail(user.email)));
  unsubscribeTrips = onSnapshot(q, (snap)=>{
    const sel=$("tripSelect");
    if(!sel) return;
    const prior = sel.value;
    sel.innerHTML="";
    const trips=[];
    snap.forEach(d=>trips.push({id:d.id,...d.data()}));
    if(!trips.length){
      sel.innerHTML='<option value="">Sin viajes</option>';
      return;
    }
    trips.sort((a,b)=>(a.title||"").localeCompare(b.title||""));
    trips.forEach(t=>{
      const opt=document.createElement("option");
      opt.value=t.id; opt.textContent=t.title || t.id;
      sel.appendChild(opt);
    });
    const next = prior && trips.some(t=>t.id===prior) ? prior : trips[0].id;
    sel.value=next;
    if(window.currentTripId !== next) selectTrip(next, user);
  }, err=>{
    console.error(err);
    setSync("Error leyendo viajes", false); const msgEl=document.getElementById("authMsg"); if(msgEl) msgEl.textContent="No se pudieron leer los viajes. Revisa las reglas de Firestore.";
  });
}


function listenTripSubcollections(tripId){
  if(unsubscribeCustomPoints) unsubscribeCustomPoints();
  if(unsubscribeItinerary) unsubscribeItinerary();
  if(unsubscribeNotes) unsubscribeNotes();
  if(unsubscribeHighlights) unsubscribeHighlights();

  if(unsubscribeDocuments) unsubscribeDocuments();
  if(unsubscribePacking) unsubscribePacking();

  unsubscribeDocuments = onSnapshot(collection(db,"trips",tripId,"documents"), snap=>{
    window.tripDocuments=[];
    snap.forEach(d=>window.tripDocuments.push({id:d.id,...d.data()}));
    renderTripDocuments();
  });

  unsubscribePacking = onSnapshot(collection(db,"trips",tripId,"packing"), snap=>{
    window.packingItems=[];
    snap.forEach(d=>window.packingItems.push({id:d.id,...d.data()}));
    renderPackingList();
  });



  unsubscribeCustomPoints = onSnapshot(collection(db,"trips",tripId,"customPoints"), snap=>{
    customPoints.length = 0;
    snap.forEach(d=>customPoints.push({uid:d.id,id:d.id,...d.data()}));
    rebuildCustomLayer(); renderPlanner(); renderTimeline(); render();
  });

  unsubscribeItinerary = onSnapshot(collection(db,"trips",tripId,"itinerary"), snap=>{
    itineraryPlan.length = 0;
    snap.forEach(d=>itineraryPlan.push({docId:d.id,...d.data()}));
    itineraryPlan.sort((a,b)=>String(a.day||'').localeCompare(String(b.day||''),'es') || (a.order||0)-(b.order||0));
    renderTimeline(); renderLiveRouteBase();
  });

  unsubscribeNotes = onSnapshot(collection(db,"trips",tripId,"notes"), snap=>{
    plannerNotes = {};
    snap.forEach(d=>{ plannerNotes[d.id]=d.data().text||''; });
    renderTimeline();
    if(activeContext) renderContext(activeContext);
  });

  unsubscribeHighlights = onSnapshot(collection(db,"trips",tripId,"highlights"), snap=>{
    const hs=[];
    snap.forEach(d=>hs.push({id:d.id,...d.data()}));
    if(!window.currentTripData) window.currentTripData={};
    window.currentTripData.state=window.currentTripData.state||{};
    window.currentTripData.state.highlights=hs;
  });
}

function selectTrip(tripId, user){
  if(unsubscribeTrip) unsubscribeTrip();
  window.setFirebaseContext({tripId, user});
  window.currentTripId = tripId;
  listenTripSubcollections(tripId);
  setSync("Firebase: sincronizando");
  unsubscribeTrip = onSnapshot(doc(db, "trips", tripId), (snap)=>{
    if(!snap.exists()) return;
    const data=snap.data();
    window.currentTripData=data;
    updateTripMetaPanel(); renderUsersPanel(); renderRecommendations(); renderTripZone(); renderLiveRouteBase();
    if(data.mapCenter && data.mapCenter.lat && data.mapCenter.lon && window.map){ try{ map.setView([data.mapCenter.lat,data.mapCenter.lon], 8); }catch(e){} }
    const state=data.state || {};
    applyingRemote = true;
    window.applyPlannerState(state);
    applyingRemote = false;
    setSync("Firebase: sincronizado");
  }, err=>{
    console.error(err);
    setSync("Error de sincronización", false);
  });
}

window.firebaseSaveTripState = async function(){
  if(applyingRemote || !window.currentTripId || !auth.currentUser) return;
  setSync("Firebase: guardando...");
  try{
    await setDoc(doc(db, "trips", window.currentTripId), {
      updatedAt: serverTimestamp(),
      updatedBy: safeEmail(auth.currentUser.email)
    }, {merge:true});
    setSync("Firebase: guardado");
  } catch(e){
    console.error(e);
    setSync("Error guardando", false);
  }
}


async function createTrip(){
  openTripWizard();
}

async function createTripFromForm(data){
  const user=auth.currentUser; 
  if(!user) return;
  if(!data.title){ 
    alert("Falta nombre del viaje."); 
    return; 
  }
  const id = data.title.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"") + "-" + Date.now().toString(36);

  const memberEmails=[...new Set([safeEmail(user.email), ...(data.memberEmails||[]).map(safeEmail).filter(Boolean)])];
  const rolesByEmail={};
  memberEmails.forEach(e=>rolesByEmail[e]=(e===safeEmail(user.email)?'owner':'editor'));

  const firstLocation=(data.locations&&data.locations[0])||data.title;
  let center=null;
  let mapZones=[];
  for(const loc of (data.locations&&data.locations.length?data.locations:[firstLocation])){
    try{
      const res=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(loc));
      const arr=await res.json();
      if(arr&&arr[0]){
        const z={lat:parseFloat(arr[0].lat), lon:parseFloat(arr[0].lon), label:arr[0].display_name, query:loc};
        mapZones.push(z);
        if(!center) center=z;
      }
    }catch(e){ console.warn('geocode failed', loc, e); }

  await setDoc(doc(db, "trips", id), {
    title:data.title,
    destination:firstLocation||"",
    locations:data.locations||[],
    startDate:data.startDate||"",
    endDate:data.endDate||"",
    style:data.style||"balanceado",
    pace:data.pace||"balanceado",
    budgetTarget:data.budgetTarget||"",
    notes:data.notes||"",
    mapCenter:center,
    mapZones:mapZones,
    ownerUid:user.uid,
    ownerEmail:safeEmail(user.email),
    allowedEmails:memberEmails,
    rolesByEmail,
    state:{itineraryPlan:[],plannerNotes:{},customPoints:[],selectedPlan:[],highlights:[]},
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp(),
    updatedBy:safeEmail(user.email)
  });
  closeTripWizard();
  const sel=$("tripSelect");
  if(sel){
    let opt=[...sel.options].find(o=>o.value===id);
    if(!opt){ opt=document.createElement("option"); opt.value=id; opt.textContent=data.title; sel.appendChild(opt); }
    sel.value=id;
  }
  selectTrip(id,user);
}

async function inviteEmail(){
  const user=auth.currentUser; 
  if(!user || !window.currentTripId) return;
  const email=safeEmail(prompt("Correo a invitar:", ""));
  if(!email) return;
  const role=(prompt("Rol: owner, editor o viewer", "editor")||"editor").toLowerCase();
  const valid = ["owner","editor","viewer"].includes(role) ? role : "editor";
  const ref=doc(db, "trips", window.currentTripId);
  await updateDoc(ref, {
    allowedEmails: arrayUnion(email),
    [`rolesByEmail.${email}`]: valid,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(user.email)
  });
  alert(email + " invitado como " + valid + ". Debe entrar con ese Google.");
}

async function firebaseInviteMemberPrompt(){
  return inviteEmail();
}

async function firebaseChangeRolePrompt(email){
  const user=auth.currentUser; 
  if(!user || !window.currentTripId) return;
  const role=(prompt("Nuevo rol para "+email+": owner, editor o viewer", "editor")||"editor").toLowerCase();
  const valid=["owner","editor","viewer"].includes(role)?role:"editor";
  await updateDoc(doc(db,"trips",window.currentTripId), {
    [`rolesByEmail.${email}`]: valid,
    updatedAt:serverTimestamp(),
    updatedBy:safeEmail(user.email)
  });
}

async function firebaseRemoveMember(email){
  const user=auth.currentUser; 
  if(!user || !window.currentTripId) return;
  if(!confirm("¿Quitar acceso a "+email+" de este viaje?")) return;
  await updateDoc(doc(db,"trips",window.currentTripId), {
    allowedEmails: arrayRemove(email),
    [`rolesByEmail.${email}`]: deleteField(),
    updatedAt:serverTimestamp(),
    updatedBy:safeEmail(user.email)
  });
}

window.firebaseInviteMemberPrompt=firebaseInviteMemberPrompt;
window.firebaseChangeRolePrompt=firebaseChangeRolePrompt;
window.firebaseRemoveMember=firebaseRemoveMember;

window.firebaseAddHighlight=async function(h){
  if(!window.currentTripId || !auth.currentUser) return;
  const id=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  await setDoc(doc(db,"trips",window.currentTripId,"highlights",id), {...h, by:safeEmail(auth.currentUser.email), createdAt:serverTimestamp()});
  alert("Highlight agregado al viaje.");
};


window.firebaseUpsertCustomPoint = async function(p){
  if(!window.currentTripId || !auth.currentUser) return;
  await setDoc(doc(db,"trips",window.currentTripId,"customPoints",p.uid), {...p, updatedAt:serverTimestamp(), updatedBy:safeEmail(auth.currentUser.email)}, {merge:true});
};
window.firebaseDeleteCustomPoint = async function(uid){
  if(!window.currentTripId || !auth.currentUser) return;
  await deleteDoc(doc(db,"trips",window.currentTripId,"customPoints",uid));
};
window.firebaseUpsertItineraryItem = async function(item, idx){
  if(!window.currentTripId || !auth.currentUser) return;
  const id=item.docId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  item.docId=id;
  await setDoc(doc(db,"trips",window.currentTripId,"itinerary",id), {...item, order:idx??item.order??Date.now(), updatedAt:serverTimestamp(), updatedBy:safeEmail(auth.currentUser.email)}, {merge:true});
};
window.firebaseDeleteItineraryItem = async function(item){
  if(!window.currentTripId || !auth.currentUser || !item.docId) return;
  await deleteDoc(doc(db,"trips",window.currentTripId,"itinerary",item.docId));
};
window.firebaseSaveNote = async function(uid,text){
  if(!window.currentTripId || !auth.currentUser) return;
  await setDoc(doc(db,"trips",window.currentTripId,"notes",uid), {text, updatedAt:serverTimestamp(), updatedBy:safeEmail(auth.currentUser.email)}, {merge:true});
};
window.firebaseDeleteNote = async function(uid){
  if(!window.currentTripId || !auth.currentUser) return;
  await deleteDoc(doc(db,"trips",window.currentTripId,"notes",uid));
};


function isPlatformAdminEmail(email){
  return PLATFORM_ADMINS.includes(safeEmail(email));
}
async function ensurePlatformRole(user){
  const isAdmin=isPlatformAdminEmail(user.email);
  window.isPlatformAdmin=isAdmin;
  await setDoc(doc(db,"users",user.uid), {
    uid:user.uid,
    email:safeEmail(user.email),
    displayName:user.displayName||"",
    photoURL:user.photoURL||"",
    globalRole:isAdmin ? "platform_admin" : "user",
    status:"active",
    lastLoginAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  }, {merge:true});
  adminRenderShell();
  if(isAdmin) adminLoadAll();
}
async function adminLoadAll(){
  if(!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const usersSnap=await getDocs(collection(db,"users"));
  const tripsSnap=await getDocs(collection(db,"trips"));
  const backlogSnap=await getDocs(collection(db,"platformBacklog"));
  window.adminCache.users=[]; usersSnap.forEach(d=>window.adminCache.users.push({uid:d.id,...d.data()}));
  window.adminCache.trips=[]; tripsSnap.forEach(d=>window.adminCache.trips.push({id:d.id,...d.data()}));
  window.adminCache.backlog=[]; backlogSnap.forEach(d=>window.adminCache.backlog.push({id:d.id,createdAtMs:d.data().createdAt?.toMillis?d.data().createdAt.toMillis():0,...d.data()}));
  adminRenderAll();
}
async function adminAssignTrip(){
  if(!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const email=safeEmail(document.getElementById('assignEmail').value);
  const role=document.getElementById('assignRole').value;
  const tripId=document.getElementById('assignTrip').value;
  if(!email||!tripId){alert('Falta email o viaje.');return;}
  await updateDoc(doc(db,"trips",tripId), {
    allowedEmails: arrayUnion(email),
    [`rolesByEmail.${email}`]: role,
    updatedAt:serverTimestamp(),
    updatedBy:safeEmail(auth.currentUser.email)
  });
  document.getElementById('assignResult').textContent=`${email} asignado a ${tripId} como ${role}`;
  adminLoadAll();
}
async function adminChangeGlobalRole(uid,email){
  if(!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const role=(prompt("Rol global para "+email+": platform_admin, user o disabled", "user")||"user").toLowerCase();
  const valid=["platform_admin","user","disabled"].includes(role)?role:"user";
  await setDoc(doc(db,"users",uid), {globalRole:valid,status:valid==="disabled"?"disabled":"active",updatedAt:serverTimestamp()}, {merge:true});
  adminLoadAll();
}
async function adminToggleUserStatus(uid,status){
  if(!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const next=status==="disabled"?"active":"disabled";
  await setDoc(doc(db,"users",uid), {status:next,updatedAt:serverTimestamp()}, {merge:true});
  adminLoadAll();
}
async function adminArchiveTrip(tripId,status){
  if(!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const next=status==="archived"?"active":"archived";
  await setDoc(doc(db,"trips",tripId), {status:next,updatedAt:serverTimestamp(),updatedBy:safeEmail(auth.currentUser.email)}, {merge:true});
  adminLoadAll();
}
async function adminDeleteTrip(tripId){
  if(!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  if(!confirm("¿Eliminar viaje "+tripId+"? Esta acción no borra subcolecciones automáticamente.")) return;
  await deleteDoc(doc(db,"trips",tripId));
  adminLoadAll();
}
function adminOpenTrip(tripId){
  const sel=document.getElementById('tripSelect');
  if(sel){ sel.value=tripId; selectTrip(tripId, auth.currentUser); showTab('mapa'); }
}
async function adminCreateBacklogItem(){
  if(!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const title=document.getElementById('backlogTitle').value.trim();
  if(!title){alert('Falta título.');return;}
  const id=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  await setDoc(doc(db,"platformBacklog",id), {
    title,
    description:document.getElementById('backlogDescription').value.trim(),
    type:document.getElementById('backlogType').value,
    priority:document.getElementById('backlogPriority').value,
    status:document.getElementById('backlogStatus').value,
    scope:"platform",
    createdBy:safeEmail(auth.currentUser.email),
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });
  document.getElementById('backlogTitle').value='';
  document.getElementById('backlogDescription').value='';
  adminLoadAll();
}
async function adminUpdateBacklogStatus(id,status){
  if(!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  await setDoc(doc(db,"platformBacklog",id), {status,updatedAt:serverTimestamp(),updatedBy:safeEmail(auth.currentUser.email)}, {merge:true});
  adminLoadAll();
}
async function adminDeleteBacklogItem(id){
  if(!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  if(!confirm("¿Eliminar ítem backlog?")) return;
  await deleteDoc(doc(db,"platformBacklog",id));
  adminLoadAll();
}
window.adminLoadAll=adminLoadAll;
window.adminAssignTrip=adminAssignTrip;
window.adminChangeGlobalRole=adminChangeGlobalRole;
window.adminToggleUserStatus=adminToggleUserStatus;
window.adminArchiveTrip=adminArchiveTrip;
window.adminDeleteTrip=adminDeleteTrip;
window.adminOpenTrip=adminOpenTrip;
window.adminCreateBacklogItem=adminCreateBacklogItem;
window.adminUpdateBacklogStatus=adminUpdateBacklogStatus;
window.adminDeleteBacklogItem=adminDeleteBacklogItem;


async function tripCreateDocument(){
  if(!window.currentTripId || !auth.currentUser) return;
  const title=document.getElementById('docTitle').value.trim();
  if(!title){alert('Falta nombre del documento.');return;}
  const id=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  await setDoc(doc(db,"trips",window.currentTripId,"documents",id), {
    title,
    type:document.getElementById('docType').value,
    owner:document.getElementById('docOwner').value.trim()||"Todos",
    date:document.getElementById('docDate').value||"",
    url:document.getElementById('docUrl').value.trim(),
    notes:document.getElementById('docNotes').value.trim(),
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp(),
    updatedBy:safeEmail(auth.currentUser.email)
  });
  ['docTitle','docOwner','docDate','docUrl','docNotes'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';});
}
async function tripEditDocument(id){
  if(!window.currentTripId || !auth.currentUser) return;
  const d=(window.tripDocuments||[]).find(x=>x.id===id); if(!d)return;
  const title=prompt("Nombre documento:", d.title||""); if(title===null)return;
  const url=prompt("Link:", d.url||""); if(url===null)return;
  const notes=prompt("Notas:", d.notes||""); if(notes===null)return;
  await setDoc(doc(db,"trips",window.currentTripId,"documents",id), {title,url,notes,updatedAt:serverTimestamp(),updatedBy:safeEmail(auth.currentUser.email)}, {merge:true});
}
async function tripDeleteDocument(id){
  if(!window.currentTripId || !auth.currentUser) return;
  if(!confirm("¿Eliminar documento?")) return;
  await deleteDoc(doc(db,"trips",window.currentTripId,"documents",id));
}
async function tripCreatePackingItemPrompt(){
  if(!window.currentTripId || !auth.currentUser) return;
  const name=prompt("Item a llevar:", ""); if(!name)return;
  const category=(prompt("Categoría: documentos, ropa, calzado, higiene, salud, tecnologia, playa, trekking, viaje, otros", "otros")||"otros").toLowerCase();
  const qty=parseInt(prompt("Cantidad:", "1")||"1",10);
  const owner=prompt("Persona: Todos / Basti / Javiera / etc.", "Todos")||"Todos";
  const id=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  await setDoc(doc(db,"trips",window.currentTripId,"packing",id), {name,category,qty:isNaN(qty)?1:qty,owner,packed:false,recommended:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:safeEmail(auth.currentUser.email)});
}
async function tripEditPackingItem(id){
  if(!window.currentTripId || !auth.currentUser) return;
  const item=(window.packingItems||[]).find(x=>x.id===id); if(!item)return;
  const name=prompt("Item:", item.name||""); if(name===null)return;
  const qty=parseInt(prompt("Cantidad:", item.qty||1)||"1",10);
  const notes=prompt("Notas:", item.notes||""); if(notes===null)return;
  await setDoc(doc(db,"trips",window.currentTripId,"packing",id), {name,qty:isNaN(qty)?1:qty,notes,updatedAt:serverTimestamp(),updatedBy:safeEmail(auth.currentUser.email)}, {merge:true});
}
async function tripDeletePackingItem(id){
  if(!window.currentTripId || !auth.currentUser) return;
  if(!confirm("¿Eliminar item de maleta?")) return;
  await deleteDoc(doc(db,"trips",window.currentTripId,"packing",id));
}
async function tripTogglePackingItem(id,packed){
  if(!window.currentTripId || !auth.currentUser) return;
  await setDoc(doc(db,"trips",window.currentTripId,"packing",id), {packed,updatedAt:serverTimestamp(),updatedBy:safeEmail(auth.currentUser.email)}, {merge:true});
}
async function generatePackingBase(){
  if(!window.currentTripId || !auth.currentUser) return;
  const trip=window.currentTripData||{};
  const climate=document.getElementById('packClimate')?.value||'templado';
  const luggage=document.getElementById('packLuggageType')?.value||'maleta';
  const notes=document.getElementById('packNotes')?.value||'';
  const items=packingBaseItems(trip,climate,luggage);
  if(!confirm(`Se agregarán ${items.length} ítems recomendados a la maleta. ¿Continuar?`)) return;
  for(const item of items){
    const id=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    await setDoc(doc(db,"trips",window.currentTripId,"packing",id), {
      ...item,
      tripClimate:climate,
      luggageType:luggage,
      generatorNotes:notes,
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp(),
      updatedBy:safeEmail(auth.currentUser.email)
    });
  }
}
window.tripCreateDocument=tripCreateDocument;
window.tripEditDocument=tripEditDocument;
window.tripDeleteDocument=tripDeleteDocument;
window.tripCreatePackingItemPrompt=tripCreatePackingItemPrompt;
window.tripEditPackingItem=tripEditPackingItem;
window.tripDeletePackingItem=tripDeletePackingItem;
window.tripTogglePackingItem=tripTogglePackingItem;
window.generatePackingBase=generatePackingBase;

$("loginBtn")?.addEventListener("click", async ()=>{
  $("authMsg").textContent="Abriendo Google...";
  try{ await signInWithPopup(auth, provider); }
  catch(e){ console.error(e); $("authMsg").textContent="Error: " + e.message; }
});
$("logoutBtn")?.addEventListener("click", ()=>signOut(auth));
$("createTripBtn")?.addEventListener("click", createTrip);
$("inviteBtn")?.addEventListener("click", inviteEmail);
$("tripSelect")?.addEventListener("change", (e)=>{ if(auth.currentUser && e.target.value) selectTrip(e.target.value, auth.currentUser); });

onAuthStateChanged(auth, async (user)=>{
  if(!user){
    $("authOverlay").style.display="flex";
    $("userLabel").textContent="";
    setSync("Firebase: sin sesión", false);
    return;
  }
  const email=safeEmail(user.email);
  $("userLabel").textContent=(user.displayName||email) + " · " + email;
  if(!ALLOWED_EMAILS.includes(email)){
    $("authMsg").innerHTML="Tu cuenta <strong>"+email+"</strong> no tiene acceso a este planner. Pide invitación al administrador del viaje.";
    $("authOverlay").style.display="flex";
    setSync("Correo no autorizado", false);
    return;
  }
  $("authOverlay").style.display="none";
  setSync("Firebase: login OK");
  await ensureUser(user);
  try {
    await ensureInitialTrip(user);
    listenTrips(user);
  } catch(e) {
    console.error(e);
    setSync("Error permisos Firestore", false);
    const msgEl=document.getElementById("authMsg");
    if(msgEl) msgEl.textContent="Login OK, pero Firestore rechazó permisos. Revisa reglas.";
  }
});
