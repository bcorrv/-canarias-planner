// Planner Firebase V31 Travel Planner modular — Firebase Auth/Firestore
// Marker: V31-FIREBASE-JS-STABLE

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { initializeFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs, collection, query, where, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
  "apiKey": "AIzaSyD35W8eEb5F7E-1JmwowTsdfgO7RMz1DvY",
  "authDomain": "planner-22b96.firebaseapp.com",
  "projectId": "planner-22b96",
  "storageBucket": "planner-22b96.firebasestorage.app",
  "messagingSenderId": "450488147512",
  "appId": "1:450488147512:web:3c27d604d54bbc19ff90cd",
  "measurementId": "G-T0Z3XTGHN7"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false
});

const PLATFORM_ADMINS = ["bo.cverdugo@gmail.com"];
const ALLOWED_EMAILS = ["bo.cverdugo@gmail.com", "javiera.sarracinav@gmail.com"];

let unsubscribeTrip = null;
let unsubscribeTrips = null;
let unsubscribeCustomPoints = null;
let unsubscribeItinerary = null;
let unsubscribeNotes = null;
let unsubscribeHighlights = null;
let unsubscribeDocuments = null;
let unsubscribePersonalDocuments = null;
let unsubscribePacking = null;
let applyingRemote = false;

window.currentUser = null;
window.currentTripId = null;
window.currentTripData = null;
window.isPlatformAdmin = false;

function $(id) {
  return document.getElementById(id);
}

function safeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function setSync(text, ok = true) {
  const el = $("syncStatus");
  if (!el) return;
  el.textContent = text;
  el.style.background = ok ? "#dcfce7" : "#fee2e2";
  el.style.color = ok ? "#166534" : "#991b1b";
}

function isPlatformAdminEmail(email) {
  return PLATFORM_ADMINS.includes(safeEmail(email));
}

async function ensureUser(user) {
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: safeEmail(user.email),
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function ensurePlatformRole(user) {
  const isAdmin = isPlatformAdminEmail(user.email);
  window.isPlatformAdmin = isAdmin;
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: safeEmail(user.email),
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    globalRole: isAdmin ? "platform_admin" : "user",
    status: "active",
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  if (window.adminRenderShell) window.adminRenderShell();
  if (isAdmin && window.adminLoadAll) window.adminLoadAll();
}

async function ensureInitialTrip(user) {
  const tripRef = doc(db, "trips", "canarias-2028");
  const snap = await getDoc(tripRef);
  if (snap.exists()) return;

  const owner = safeEmail(user.email);
  const allowed = Array.from(new Set([owner, "javiera.sarracinav@gmail.com", "bo.cverdugo@gmail.com"]));
  const roles = {};
  allowed.forEach(function(email) {
    roles[email] = email === owner ? "owner" : "editor";
  });
  roles["bo.cverdugo@gmail.com"] = "owner";

  await setDoc(tripRef, {
    title: "Canarias 2028",
    destination: "Islas Canarias",
    locations: ["Tenerife", "Gran Canaria", "Lanzarote", "La Graciosa"],
    startDate: "",
    endDate: "",
    style: "balanceado",
    pace: "balanceado",
    budgetTarget: "",
    notes: "Viaje inicial precargado.",
    ownerUid: user.uid,
    ownerEmail: owner,
    allowedEmails: allowed,
    rolesByEmail: roles,
    status: "active",
    state: {
      itineraryPlan: [],
      plannerNotes: {},
      customPoints: [],
      selectedPlan: [],
      highlights: []
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: owner
  }, { merge: true });
}

function applyLegacyState(data) {
  const state = data.state || {};
  applyingRemote = true;
  try {
    if (Array.isArray(state.customPoints) && window.customPoints) {
      window.customPoints.length = 0;
      state.customPoints.forEach(function(point) { window.customPoints.push(point); });
      if (window.rebuildCustomLayer) window.rebuildCustomLayer();
    }
    if (Array.isArray(state.itineraryPlan) && window.itineraryPlan) {
      window.itineraryPlan.length = 0;
      state.itineraryPlan.forEach(function(item) { window.itineraryPlan.push(item); });
    }
    if (state.plannerNotes && typeof state.plannerNotes === "object") {
      window.plannerNotes = state.plannerNotes;
    }
    if (Array.isArray(state.selectedPlan) && window.selectedPlan) {
      window.selectedPlan = new Set(state.selectedPlan);
    }
    if (window.renderPlanner) window.renderPlanner();
    if (window.renderTimeline) window.renderTimeline();
    if (window.render) window.render();
  } finally {
    applyingRemote = false;
  }
}

function listenTripSubcollections(tripId) {
  if (unsubscribeCustomPoints) unsubscribeCustomPoints();
  if (unsubscribeItinerary) unsubscribeItinerary();
  if (unsubscribeNotes) unsubscribeNotes();
  if (unsubscribeHighlights) unsubscribeHighlights();
  if (unsubscribeDocuments) unsubscribeDocuments();
  if (unsubscribePersonalDocuments) unsubscribePersonalDocuments();
  if (unsubscribePacking) unsubscribePacking();

  unsubscribeCustomPoints = onSnapshot(collection(db, "trips", tripId, "customPoints"), function(snap) {
    if (!window.customPoints) return;
    window.customPoints.length = 0;
    snap.forEach(function(d) { window.customPoints.push(Object.assign({ uid: d.id, id: d.id }, d.data())); });
    if (window.rebuildCustomLayer) window.rebuildCustomLayer();
    if (window.renderPlanner) window.renderPlanner();
    if (window.renderTimeline) window.renderTimeline();
    if (window.render) window.render();
  });

  unsubscribeItinerary = onSnapshot(collection(db, "trips", tripId, "itinerary"), function(snap) {
    if (!window.itineraryPlan) return;
    window.itineraryPlan.length = 0;
    snap.forEach(function(d) { window.itineraryPlan.push(Object.assign({ docId: d.id }, d.data())); });
    window.itineraryPlan.sort(function(a, b) {
      return String(a.day || "").localeCompare(String(b.day || ""), "es") || Number(a.order || 0) - Number(b.order || 0);
    });
    if (window.renderTimeline) window.renderTimeline();
    if (window.renderLiveRouteBase) window.renderLiveRouteBase();
  });

  unsubscribeNotes = onSnapshot(collection(db, "trips", tripId, "notes"), function(snap) {
    window.plannerNotes = {};
    snap.forEach(function(d) { window.plannerNotes[d.id] = d.data().text || ""; });
    if (window.renderTimeline) window.renderTimeline();
    if (window.activeContext && window.renderContext) window.renderContext(window.activeContext);
  });

  unsubscribeHighlights = onSnapshot(collection(db, "trips", tripId, "highlights"), function(snap) {
    const highlights = [];
    snap.forEach(function(d) { highlights.push(Object.assign({ id: d.id }, d.data())); });
    window.currentTripData = window.currentTripData || {};
    window.currentTripData.state = window.currentTripData.state || {};
    window.currentTripData.state.highlights = highlights;
  });

  unsubscribeDocuments = onSnapshot(collection(db, "trips", tripId, "documents"), function(snap) {
    const tripDocs = [];
    snap.forEach(function(d) { tripDocs.push(Object.assign({ id: d.id, scope: "trip" }, d.data())); });
    const personalDocs = window.personalDocuments || [];
    window.tripDocuments = tripDocs.concat(personalDocs);
    if (window.renderTripDocuments) window.renderTripDocuments();
  });

  if (auth.currentUser) {
    unsubscribePersonalDocuments = onSnapshot(collection(db, "users", auth.currentUser.uid, "privateDocuments"), function(snap) {
      window.personalDocuments = [];
      snap.forEach(function(d) { window.personalDocuments.push(Object.assign({ id: d.id, scope: "personal" }, d.data())); });
      const tripDocs = (window.tripDocuments || []).filter(function(x) { return x.scope !== "personal"; });
      window.tripDocuments = tripDocs.concat(window.personalDocuments);
      if (window.renderTripDocuments) window.renderTripDocuments();
    });
  }

  unsubscribePacking = onSnapshot(collection(db, "trips", tripId, "packing"), function(snap) {
    window.packingItems = [];
    snap.forEach(function(d) { window.packingItems.push(Object.assign({ id: d.id }, d.data())); });
    if (window.renderPackingList) window.renderPackingList();
  });
}

function listenTrips(user) {
  const email = safeEmail(user.email);
  if (unsubscribeTrips) unsubscribeTrips();

  const tripsRef = collection(db, "trips");
  const q = query(tripsRef, where("allowedEmails", "array-contains", email));

  unsubscribeTrips = onSnapshot(q, function(snap) {
    const select = $("tripSelect");
    if (!select) return;

    const current = select.value || window.currentTripId || "canarias-2028";
    select.innerHTML = "";
    const trips = [];

    snap.forEach(function(d) {
      trips.push(Object.assign({ id: d.id }, d.data()));
    });

    trips.sort(function(a, b) {
      return String(a.title || a.id).localeCompare(String(b.title || b.id), "es");
    });

    trips.forEach(function(t) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.title || t.id;
      select.appendChild(opt);
    });

    if (trips.length) {
      const chosen = trips.find(function(t) { return t.id === current; }) ? current : trips[0].id;
      select.value = chosen;
      if (chosen !== window.currentTripId) selectTrip(chosen, user);
    }

    if (window.adminLoadAll && isPlatformAdminEmail(user.email)) window.adminLoadAll();
  }, function(error) {
    console.error(error);
    setSync("Error leyendo viajes", false);
  });
}

function selectTrip(tripId, user) {
  window.currentTripId = tripId;
  if (window.setFirebaseContext) window.setFirebaseContext({ tripId: tripId, user: user });
  listenTripSubcollections(tripId);

  if (unsubscribeTrip) unsubscribeTrip();
  const tripRef = doc(db, "trips", tripId);

  unsubscribeTrip = onSnapshot(tripRef, function(snap) {
    if (!snap.exists()) {
      setSync("Viaje no encontrado", false);
      return;
    }
    const data = Object.assign({ id: snap.id }, snap.data());
    window.currentTripData = data;

    applyLegacyState(data);

    if (window.updateTripMetaPanel) window.updateTripMetaPanel();
    if (window.renderUsersPanel) window.renderUsersPanel();
    if (window.renderRecommendations) window.renderRecommendations();
    if (window.renderTripZone) window.renderTripZone();
    if (window.renderLiveRouteBase) window.renderLiveRouteBase();

    setSync("Firebase: sincronizado");
  }, function(error) {
    console.error(error);
    setSync("Error viaje", false);
  });
}

async function createTrip() {
  if (window.openTripWizard) window.openTripWizard();
}

async function createTripFromForm(data) {
  const user = auth.currentUser;
  if (!user) return;
  if (!data.title) {
    alert("Falta nombre del viaje.");
    return;
  }

  const id = data.title.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + Date.now().toString(36);

  const memberEmails = Array.from(new Set([safeEmail(user.email)].concat((data.memberEmails || []).map(safeEmail).filter(Boolean))));
  const rolesByEmail = {};
  memberEmails.forEach(function(email) {
    rolesByEmail[email] = email === safeEmail(user.email) ? "owner" : "editor";
  });

  const firstLocation = data.locations && data.locations[0] ? data.locations[0] : data.title;
  let center = null;
  let mapZones = [];
  const locationsToGeocode = data.locations && data.locations.length ? data.locations : [firstLocation];

  for (const loc of locationsToGeocode) {
    try {
      const res = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(loc));
      const arr = await res.json();
      if (arr && arr[0]) {
        const z = {
          lat: parseFloat(arr[0].lat),
          lon: parseFloat(arr[0].lon),
          label: arr[0].display_name,
          query: loc
        };
        mapZones.push(z);
        if (!center) center = z;
      }
    } catch (e) {
      console.warn("geocode failed", loc, e);
    }
  }

  await setDoc(doc(db, "trips", id), {
    title: data.title,
    destination: firstLocation || "",
    locations: data.locations || [],
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    style: data.style || "balanceado",
    pace: data.pace || "balanceado",
    budgetTarget: data.budgetTarget || "",
    notes: data.notes || "",
    mapCenter: center,
    mapZones: mapZones,
    ownerUid: user.uid,
    ownerEmail: safeEmail(user.email),
    allowedEmails: memberEmails,
    rolesByEmail: rolesByEmail,
    status: "active",
    state: {
      itineraryPlan: [],
      plannerNotes: {},
      customPoints: [],
      selectedPlan: [],
      highlights: []
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(user.email)
  });

  if (window.closeTripWizard) window.closeTripWizard();

  const select = $("tripSelect");
  if (select) {
    let opt = Array.from(select.options).find(function(o) { return o.value === id; });
    if (!opt) {
      opt = document.createElement("option");
      opt.value = id;
      opt.textContent = data.title;
      select.appendChild(opt);
    }
    select.value = id;
  }
  selectTrip(id, user);
}

async function inviteEmail() {
  const user = auth.currentUser;
  if (!user || !window.currentTripId) return;

  const email = safeEmail(prompt("Correo a invitar:", ""));
  if (!email) return;

  const roleInput = (prompt("Rol: owner, editor o viewer", "editor") || "editor").toLowerCase();
  const role = ["owner", "editor", "viewer"].includes(roleInput) ? roleInput : "editor";

  await updateDoc(doc(db, "trips", window.currentTripId), {
    allowedEmails: arrayUnion(email),
    ["rolesByEmail." + email]: role,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(user.email)
  });

  alert(email + " invitado como " + role + ". Debe entrar con ese Google.");
}

window.firebaseSaveTripState = async function firebaseSaveTripState() {
  if (applyingRemote || !window.currentTripId || !auth.currentUser) return;
  setSync("Firebase: guardando...");
  try {
    await setDoc(doc(db, "trips", window.currentTripId), {
      updatedAt: serverTimestamp(),
      updatedBy: safeEmail(auth.currentUser.email)
    }, { merge: true });
    setSync("Firebase: guardado");
  } catch (e) {
    console.error(e);
    setSync("Error guardando", false);
  }
};

window.firebaseUpsertCustomPoint = async function firebaseUpsertCustomPoint(point) {
  if (!window.currentTripId || !auth.currentUser || !point || !point.uid) return;
  await setDoc(doc(db, "trips", window.currentTripId, "customPoints", point.uid), Object.assign({}, point, {
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  }), { merge: true });
};

window.firebaseDeleteCustomPoint = async function firebaseDeleteCustomPoint(uid) {
  if (!window.currentTripId || !auth.currentUser || !uid) return;
  await deleteDoc(doc(db, "trips", window.currentTripId, "customPoints", uid));
};

window.firebaseUpsertItineraryItem = async function firebaseUpsertItineraryItem(item, order) {
  if (!window.currentTripId || !auth.currentUser || !item) return;
  const id = item.docId || (Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8));
  item.docId = id;
  await setDoc(doc(db, "trips", window.currentTripId, "itinerary", id), Object.assign({}, item, {
    order: order || item.order || Date.now(),
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  }), { merge: true });
};

window.firebaseDeleteItineraryItem = async function firebaseDeleteItineraryItem(item) {
  if (!window.currentTripId || !auth.currentUser || !item || !item.docId) return;
  await deleteDoc(doc(db, "trips", window.currentTripId, "itinerary", item.docId));
};

window.firebaseSaveNote = async function firebaseSaveNote(uid, text) {
  if (!window.currentTripId || !auth.currentUser || !uid) return;
  await setDoc(doc(db, "trips", window.currentTripId, "notes", uid), {
    text: text || "",
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  }, { merge: true });
};

window.firebaseDeleteNote = async function firebaseDeleteNote(uid) {
  if (!window.currentTripId || !auth.currentUser || !uid) return;
  await deleteDoc(doc(db, "trips", window.currentTripId, "notes", uid));
};

window.firebaseAddHighlight = async function firebaseAddHighlight(highlight) {
  if (!window.currentTripId || !auth.currentUser) return;
  const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  await setDoc(doc(db, "trips", window.currentTripId, "highlights", id), Object.assign({}, highlight, {
    by: safeEmail(auth.currentUser.email),
    createdAt: serverTimestamp()
  }));
  alert("Highlight agregado al viaje.");
};








window.tripCreateDocument = async function tripCreateDocument() {
  if (!window.currentTripId || !auth.currentUser) return;
  const title = $("docTitle") ? $("docTitle").value.trim() : "";
  if (!title) {
    alert("Falta nombre del documento.");
    return;
  }

  const scope = $("docScope") ? $("docScope").value : "trip";
  const fileEl = $("docFile");
  const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
  const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  let fileName = "";
  let fileSize = 0;
  let contentType = "";
  let storagePath = "";
  let downloadUrl = "";

  try {
    if (file) {
      fileName = file.name;
      fileSize = file.size;
      contentType = file.type || "application/octet-stream";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      storagePath = scope === "personal"
        ? "users/" + auth.currentUser.uid + "/privateDocuments/" + id + "/" + safeName
        : "trips/" + window.currentTripId + "/documents/" + id + "/" + safeName;
      const sref = storageRef(storage, storagePath);
      await uploadBytes(sref, file, { contentType: contentType });
      downloadUrl = await getDownloadURL(sref);
    }

    const data = {
      title: title,
      scope: scope,
      type: $("docType") ? $("docType").value : "otro",
      status: $("docStatus") ? $("docStatus").value : (file || ($("docUrl") && $("docUrl").value.trim()) ? "loaded" : "pending"),
      owner: $("docOwner") && $("docOwner").value.trim() ? $("docOwner").value.trim() : "Todos",
      date: $("docDate") ? $("docDate").value : "",
      url: $("docUrl") ? $("docUrl").value.trim() : "",
      notes: $("docNotes") ? $("docNotes").value.trim() : "",
      fileName: fileName,
      fileSize: fileSize,
      contentType: contentType,
      storagePath: storagePath,
      downloadUrl: downloadUrl,
      tripId: window.currentTripId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: safeEmail(auth.currentUser.email)
    };

    if (scope === "personal") {
      await setDoc(doc(db, "users", auth.currentUser.uid, "privateDocuments", id), data);
    } else {
      await setDoc(doc(db, "trips", window.currentTripId, "documents", id), data);
    }

    ["docTitle", "docOwner", "docDate", "docUrl", "docNotes"].forEach(function(x) {
      const el = $(x);
      if (el) el.value = "";
    });
    if (fileEl) fileEl.value = "";
  } catch (e) {
    console.error(e);
    alert("No se pudo guardar/subir el documento. Revisa Storage Rules o usa link externo.");
  }
};

window.tripEditDocument = async function tripEditDocument(id) {
  if (!window.currentTripId || !auth.currentUser) return;
  const d = (window.tripDocuments || []).find(function(x) { return x.id === id; });
  if (!d) return;
  const title = prompt("Nombre documento:", d.title || "");
  if (title === null) return;
  const url = prompt("Link:", d.url || "");
  if (url === null) return;
  const notes = prompt("Notas:", d.notes || "");
  if (notes === null) return;
  const refDoc = d.scope === "personal"
    ? doc(db, "users", auth.currentUser.uid, "privateDocuments", id)
    : doc(db, "trips", window.currentTripId, "documents", id);
  await setDoc(refDoc, {
    title: title,
    url: url,
    notes: notes,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  }, { merge: true });
};

window.tripMarkDocument = async function tripMarkDocument(id, status) {
  if (!window.currentTripId || !auth.currentUser) return;
  const d = (window.tripDocuments || []).find(function(x) { return x.id === id; });
  if (!d) return;
  const refDoc = d.scope === "personal"
    ? doc(db, "users", auth.currentUser.uid, "privateDocuments", id)
    : doc(db, "trips", window.currentTripId, "documents", id);
  await setDoc(refDoc, {
    status: status,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  }, { merge: true });
};

window.tripDeleteDocument = async function tripDeleteDocument(id, scope) {
  if (!window.currentTripId || !auth.currentUser) return;
  const d = (window.tripDocuments || []).find(function(x) { return x.id === id; });
  if (!confirm("¿Eliminar documento?")) return;
  try {
    if (d && d.storagePath) {
      try {
        await deleteObject(storageRef(storage, d.storagePath));
      } catch (e) {
        console.warn("No se pudo borrar archivo Storage", e);
      }
    }
    if ((scope || (d && d.scope)) === "personal") {
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "privateDocuments", id));
    } else {
      await deleteDoc(doc(db, "trips", window.currentTripId, "documents", id));
    }
  } catch (e) {
    console.error(e);
    alert("No se pudo eliminar el documento.");
  }
};

window.generateRequiredDocuments = async function generateRequiredDocuments() {
  if (!window.currentTripId || !auth.currentUser || !window.requiredDocumentsForTrip) return;
  const required = window.requiredDocumentsForTrip();
  if (!confirm("Se crearán " + required.length + " documentos requeridos como pendientes. ¿Continuar?")) return;
  for (const item of required) {
    const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    await setDoc(doc(db, "trips", window.currentTripId, "documents", id), Object.assign({}, item, {
      scope: "trip",
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: safeEmail(auth.currentUser.email)
    }));
  }
};

window.tripCreatePackingItemPrompt = async function tripCreatePackingItemPrompt() {
  if (!window.currentTripId || !auth.currentUser) return;
  const name = prompt("Item a llevar:", "");
  if (!name) return;
  const category = (prompt("Categoría: documentos, ropa, calzado, higiene, salud, tecnologia, playa, trekking, viaje, otros", "otros") || "otros").toLowerCase();
  const qty = parseInt(prompt("Cantidad:", "1") || "1", 10);
  const owner = prompt("Persona: Todos / Basti / Javiera / etc.", "Todos") || "Todos";
  const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  await setDoc(doc(db, "trips", window.currentTripId, "packing", id), {
    name: name,
    category: category,
    qty: isNaN(qty) ? 1 : qty,
    owner: owner,
    packed: false,
    recommended: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  });
};

window.tripEditPackingItem = async function tripEditPackingItem(id) {
  if (!window.currentTripId || !auth.currentUser) return;
  const item = (window.packingItems || []).find(function(x) { return x.id === id; });
  if (!item) return;
  const name = prompt("Item:", item.name || "");
  if (name === null) return;
  const qty = parseInt(prompt("Cantidad:", item.qty || 1) || "1", 10);
  const notes = prompt("Notas:", item.notes || "");
  if (notes === null) return;
  await setDoc(doc(db, "trips", window.currentTripId, "packing", id), {
    name: name,
    qty: isNaN(qty) ? 1 : qty,
    notes: notes,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  }, { merge: true });
};

window.tripDeletePackingItem = async function tripDeletePackingItem(id) {
  if (!window.currentTripId || !auth.currentUser) return;
  if (!confirm("¿Eliminar item de maleta?")) return;
  await deleteDoc(doc(db, "trips", window.currentTripId, "packing", id));
};

window.tripTogglePackingItem = async function tripTogglePackingItem(id, packed) {
  if (!window.currentTripId || !auth.currentUser) return;
  await setDoc(doc(db, "trips", window.currentTripId, "packing", id), {
    packed: packed,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  }, { merge: true });
};

window.generatePackingBase = async function generatePackingBase() {
  if (!window.currentTripId || !auth.currentUser || !window.packingBaseItems) return;
  const climate = $("packClimate") ? $("packClimate").value : "templado";
  const luggage = $("packLuggageType") ? $("packLuggageType").value : "maleta";
  const notes = $("packNotes") ? $("packNotes").value : "";
  const items = window.packingBaseItems(window.currentTripData || {}, climate, luggage);
  if (!confirm("Se agregarán " + items.length + " ítems recomendados a la maleta. ¿Continuar?")) return;

  for (const item of items) {
    const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    await setDoc(doc(db, "trips", window.currentTripId, "packing", id), Object.assign({}, item, {
      tripClimate: climate,
      luggageType: luggage,
      generatorNotes: notes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: safeEmail(auth.currentUser.email)
    }));
  }
};

window.firebaseInviteMemberPrompt = inviteEmail;

window.firebaseChangeRolePrompt = async function firebaseChangeRolePrompt(email) {
  const user = auth.currentUser;
  if (!user || !window.currentTripId) return;
  const roleInput = (prompt("Nuevo rol para " + email + ": owner, editor o viewer", "editor") || "editor").toLowerCase();
  const role = ["owner", "editor", "viewer"].includes(roleInput) ? roleInput : "editor";
  await updateDoc(doc(db, "trips", window.currentTripId), {
    ["rolesByEmail." + email]: role,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(user.email)
  });
};

window.firebaseRemoveMember = async function firebaseRemoveMember(email) {
  const user = auth.currentUser;
  if (!user || !window.currentTripId) return;
  if (!confirm("¿Quitar acceso a " + email + " de este viaje?")) return;
  await updateDoc(doc(db, "trips", window.currentTripId), {
    allowedEmails: arrayRemove(email),
    ["rolesByEmail." + email]: deleteField(),
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(user.email)
  });
};

window.adminLoadAll = async function adminLoadAll() {
  if (!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const usersSnap = await getDocs(collection(db, "users"));
  const tripsSnap = await getDocs(collection(db, "trips"));
  const backlogSnap = await getDocs(collection(db, "platformBacklog"));

  window.adminCache = window.adminCache || {};
  window.adminCache.users = [];
  usersSnap.forEach(function(d) { window.adminCache.users.push(Object.assign({ uid: d.id }, d.data())); });
  window.adminCache.trips = [];
  tripsSnap.forEach(function(d) { window.adminCache.trips.push(Object.assign({ id: d.id }, d.data())); });
  window.adminCache.backlog = [];
  backlogSnap.forEach(function(d) {
    const data = d.data();
    window.adminCache.backlog.push(Object.assign({ id: d.id, createdAtMs: data.createdAt && data.createdAt.toMillis ? data.createdAt.toMillis() : 0 }, data));
  });
  if (window.adminRenderAll) window.adminRenderAll();
};

window.adminAssignTrip = async function adminAssignTrip() {
  if (!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const email = safeEmail($("assignEmail") ? $("assignEmail").value : "");
  const role = $("assignRole") ? $("assignRole").value : "editor";
  const tripId = $("assignTrip") ? $("assignTrip").value : "";
  if (!email || !tripId) {
    alert("Falta email o viaje.");
    return;
  }
  await updateDoc(doc(db, "trips", tripId), {
    allowedEmails: arrayUnion(email),
    ["rolesByEmail." + email]: role,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  });
  if ($("assignResult")) $("assignResult").textContent = email + " asignado a " + tripId + " como " + role;
  window.adminLoadAll();
};

window.adminChangeGlobalRole = async function adminChangeGlobalRole(uid, email) {
  if (!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const roleInput = (prompt("Rol global para " + email + ": platform_admin, user o disabled", "user") || "user").toLowerCase();
  const role = ["platform_admin", "user", "disabled"].includes(roleInput) ? roleInput : "user";
  await setDoc(doc(db, "users", uid), {
    globalRole: role,
    status: role === "disabled" ? "disabled" : "active",
    updatedAt: serverTimestamp()
  }, { merge: true });
  window.adminLoadAll();
};

window.adminToggleUserStatus = async function adminToggleUserStatus(uid, status) {
  if (!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const next = status === "disabled" ? "active" : "disabled";
  await setDoc(doc(db, "users", uid), { status: next, updatedAt: serverTimestamp() }, { merge: true });
  window.adminLoadAll();
};

window.adminArchiveTrip = async function adminArchiveTrip(tripId, status) {
  if (!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const next = status === "archived" ? "active" : "archived";
  await setDoc(doc(db, "trips", tripId), {
    status: next,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  }, { merge: true });
  window.adminLoadAll();
};

window.adminDeleteTrip = async function adminDeleteTrip(tripId) {
  if (!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  if (!confirm("¿Eliminar viaje " + tripId + "? Esta acción no borra subcolecciones automáticamente.")) return;
  await deleteDoc(doc(db, "trips", tripId));
  window.adminLoadAll();
};

window.adminOpenTrip = function adminOpenTrip(tripId) {
  const select = $("tripSelect");
  if (select) select.value = tripId;
  selectTrip(tripId, auth.currentUser);
  if (window.showTab) window.showTab("mapa");
};

window.adminCreateBacklogItem = async function adminCreateBacklogItem() {
  if (!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  const title = $("backlogTitle") ? $("backlogTitle").value.trim() : "";
  if (!title) {
    alert("Falta título.");
    return;
  }
  const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  await setDoc(doc(db, "platformBacklog", id), {
    title: title,
    description: $("backlogDescription") ? $("backlogDescription").value.trim() : "",
    type: $("backlogType") ? $("backlogType").value : "feature",
    priority: $("backlogPriority") ? $("backlogPriority").value : "medium",
    status: $("backlogStatus") ? $("backlogStatus").value : "new",
    scope: "platform",
    createdBy: safeEmail(auth.currentUser.email),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  if ($("backlogTitle")) $("backlogTitle").value = "";
  if ($("backlogDescription")) $("backlogDescription").value = "";
  window.adminLoadAll();
};

window.adminUpdateBacklogStatus = async function adminUpdateBacklogStatus(id, status) {
  if (!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  await setDoc(doc(db, "platformBacklog", id), {
    status: status,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail(auth.currentUser.email)
  }, { merge: true });
  window.adminLoadAll();
};

window.adminDeleteBacklogItem = async function adminDeleteBacklogItem(id) {
  if (!auth.currentUser || !isPlatformAdminEmail(auth.currentUser.email)) return;
  if (!confirm("¿Eliminar ítem backlog?")) return;
  await deleteDoc(doc(db, "platformBacklog", id));
  window.adminLoadAll();
};

document.addEventListener("DOMContentLoaded", function() {
  const loginBtn = $("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async function() {
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        console.error(e);
        const msg = $("authMsg");
        if (msg) msg.textContent = "Error: " + e.message;
      }
    });
  }

  const logoutBtn = $("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", function() { signOut(auth); });

  const createTripBtn = $("createTripBtn");
  if (createTripBtn) createTripBtn.addEventListener("click", createTrip);

  const inviteBtn = $("inviteBtn");
  if (inviteBtn) inviteBtn.addEventListener("click", inviteEmail);

  const tripSelect = $("tripSelect");
  if (tripSelect) {
    tripSelect.addEventListener("change", function(e) {
      if (auth.currentUser && e.target.value) selectTrip(e.target.value, auth.currentUser);
    });
  }

  const form = $("tripWizardForm");
  if (form && window.parseTripWizard) {
    form.addEventListener("submit", function(e) {
      e.preventDefault();
      createTripFromForm(window.parseTripWizard());
    });
  }
});

onAuthStateChanged(auth, async function(user) {
  window.currentUser = user || null;
  if (!user) {
    const overlay = $("authOverlay");
    if (overlay) overlay.style.display = "flex";
    const label = $("userLabel");
    if (label) label.textContent = "";
    setSync("Firebase: sin sesión", false);
    return;
  }

  const email = safeEmail(user.email);
  const label = $("userLabel");
  if (label) label.textContent = (user.displayName || email) + " · " + email;

  if (!ALLOWED_EMAILS.includes(email) && !isPlatformAdminEmail(email)) {
    const msg = $("authMsg");
    if (msg) msg.innerHTML = "Tu cuenta <strong>" + email + "</strong> no tiene acceso a este planner. Pide invitación al administrador del viaje.";
    const overlay = $("authOverlay");
    if (overlay) overlay.style.display = "flex";
    setSync("Correo no autorizado", false);
    return;
  }

  const overlay = $("authOverlay");
  if (overlay) overlay.style.display = "none";
  setSync("Firebase: login OK");

  try {
    await ensureUser(user);
    await ensurePlatformRole(user);
    await ensureInitialTrip(user);
    listenTrips(user);
  } catch (e) {
    console.error(e);
    setSync("Error permisos Firestore", false);
    const msg = $("authMsg");
    if (msg) msg.textContent = "Login OK, pero Firestore rechazó permisos. Revisa reglas.";
  }
});

console.log("V31-FIREBASE-JS-STABLE loaded");
