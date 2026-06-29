import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import scrapedReports from './data/scraped_reports.json';

// Obtener variables de entorno de Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validar si la configuración es real (no valores por defecto de ejemplo)
const isConfigValid = firebaseConfig.apiKey && 
                     firebaseConfig.apiKey !== 'TU_API_KEY' && 
                     !firebaseConfig.apiKey.startsWith('YOUR_');

let db = null;
let isFirebaseConnected = false;

if (isConfigValid) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isFirebaseConnected = true;
    console.log("🔥 Firebase Firestore conectado con éxito.");
  } catch (error) {
    console.error("❌ Error al inicializar Firebase:", error);
  }
} else {
  console.log("ℹ️ Corriendo en Modo Local (LocalStorage). Para conectar Firebase, configure su archivo .env");
}

// Datos semilla mock de desaparecidos en Venezuela para demostración
const INITIAL_MOCK_REPORTS = [
  {
    id: 'mock-1',
    name: 'Carlos Mendoza',
    phone: '+58 412-555-0192',
    status: 'missing', // missing | located | safe | hospitalized
    location: { lat: 10.4806, lng: -66.9036 }, // Caracas
    locationName: 'Caracas, Altamira',
    description: 'Visto por última vez cerca de la Plaza Altamira durante el movimiento sísmico. Vestía franela azul y jeans oscuros. Estatura 1.75m.',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'mock-2',
    name: 'María Alejandra Gómez',
    phone: '+58 424-998-1122',
    status: 'safe',
    location: { lat: 10.2469, lng: -67.5958 }, // Maracay
    locationName: 'Maracay, El Limón',
    description: 'Reportada a salvo. Se encuentra en casa de familiares en El Limón. Celular descargado pero en buen estado físico.',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'mock-3',
    name: 'José Gregorio Rivas',
    phone: '+58 416-887-3344',
    status: 'missing',
    location: { lat: 10.1628, lng: -68.0078 }, // Valencia
    locationName: 'Valencia, Av. Bolívar Norte',
    description: 'Buscando información de José. Trabaja en el Centro Comercial El Recreo y no ha regresado a casa desde las 10 AM. Complexión robusta.',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
  },
  {
    id: 'mock-4',
    name: 'Ana Lucía Torres',
    phone: '+58 412-443-5566',
    status: 'located', // ubicado/encontrado pero requiere apoyo/comunicación
    location: { lat: 10.0678, lng: -69.3475 }, // Barquisimeto
    locationName: 'Barquisimeto, Cabudare',
    description: 'Localizada en refugio de Defensa Civil. Presenta lesiones leves en el brazo. Familiares notificados pero sin comunicación directa aún.',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'mock-5',
    name: 'Eduardo Rengifo',
    phone: '+58 412-888-2233',
    status: 'hospitalized', // Hospitalizado
    location: { lat: 10.4901, lng: -66.8920 }, // Caracas
    locationName: 'Caracas, Hospital Pérez Carreño',
    hospitalName: 'Hospital Pérez Carreño',
    hospitalDetails: 'Sala de Traumatología, Cama 12. Fractura de fémur, condición estable y en recuperación.',
    description: 'Encontrado por brigadas de rescate en la zona de El Paraíso. Trasladado de inmediato para atención médica.',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
  }
];

// Inicializar localStorage si está vacío
if (!localStorage.getItem('venezuela_earthquake_reports')) {
  localStorage.setItem('venezuela_earthquake_reports', JSON.stringify(INITIAL_MOCK_REPORTS));
}

// Sincronizar reportes extraídos (scraped) en LocalStorage de forma incremental
try {
  const localData = JSON.parse(localStorage.getItem('venezuela_earthquake_reports')) || [];
  let updated = false;

  scrapedReports.forEach((scraped, index) => {
    const scrapedNameNormalized = scraped.name.toLowerCase().trim();
    const exists = localData.some(r => r.name.toLowerCase().trim() === scrapedNameNormalized);
    if (!exists) {
      localData.push({
        id: `scraped-${index}-${Date.now()}`,
        name: scraped.name,
        phone: '+58 000-000-0000',
        status: scraped.status || 'missing',
        location: { lat: 10.4806, lng: -66.9036 }, // Caracas por defecto para reportes locales
        locationName: scraped.locationName || 'Desconocido',
        description: scraped.description || 'Sin detalles adicionales.',
        photo: scraped.photoUrl || null,
        createdAt: scraped.createdAt || new Date().toISOString()
      });
      updated = true;
    }
  });

  if (updated) {
    localStorage.setItem('venezuela_earthquake_reports', JSON.stringify(localData));
    console.log(`🔥 Sincronizados ${scrapedReports.length} reportes extraídos en LocalStorage.`);
  }
} catch (e) {
  console.error("Error sincronizando reportes extraídos en LocalStorage:", e);
}

/**
 * Escucha los reportes en tiempo real.
 * Si Firebase está conectado, usa Firestore. Si no, usa localStorage y simula eventos.
 */
export const subscribeToReports = (onUpdate) => {
  if (isFirebaseConnected && db) {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const reports = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        reports.push({
          id: doc.id,
          ...data,
          // Convertir serverTimestamp a string ISO
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
        });
      });
      onUpdate(reports);
    }, (error) => {
      console.error("Error al suscribirse a Firestore:", error);
    });
  } else {
    // Modo Local
    const loadLocal = () => {
      try {
        const data = localStorage.getItem('venezuela_earthquake_reports');
        const list = JSON.parse(data) || [];
        // Ordenar por fecha de creación desc
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        onUpdate(list);
      } catch (e) {
        console.error(e);
      }
    };

    loadLocal();

    // Escuchar cambios locales de esta o de otras pestañas
    const listener = (e) => {
      if (!e.key || e.key === 'venezuela_earthquake_reports') {
        loadLocal();
      }
    };
    window.addEventListener('storage', listener);

    // Retornar función para desuscribirse
    return () => {
      window.removeEventListener('storage', listener);
    };
  }
};

/**
 * Guarda un reporte.
 */
export const addReport = async (reportData) => {
  const newReport = {
    name: reportData.name,
    phone: reportData.phone,
    status: reportData.status || 'missing',
    location: {
      lat: Number(reportData.location.lat),
      lng: Number(reportData.location.lng)
    },
    locationName: reportData.locationName,
    description: reportData.description || '',
    photo: reportData.photo || null,
    hospitalName: reportData.hospitalName || '',
    hospitalDetails: reportData.hospitalDetails || '',
    cedula: reportData.cedula || '',
    createdAt: isFirebaseConnected ? serverTimestamp() : new Date().toISOString()
  };

  if (isFirebaseConnected && db) {
    try {
      const docRef = await addDoc(collection(db, 'reports'), newReport);
      return docRef.id;
    } catch (error) {
      console.error("Error guardando en Firestore:", error);
      throw error;
    }
  } else {
    // Modo Local
    try {
      const localData = JSON.parse(localStorage.getItem('venezuela_earthquake_reports')) || [];
      const reportWithId = {
        id: 'local-' + Date.now(),
        ...newReport,
        createdAt: new Date().toISOString()
      };
      localData.push(reportWithId);
      localStorage.setItem('venezuela_earthquake_reports', JSON.stringify(localData));
      
      // Lanzar evento storage manualmente para actualizar componentes en la misma pestaña
      window.dispatchEvent(new Event('storage'));
      // Desencadenar actualización local
      return reportWithId.id;
    } catch (e) {
      console.error("Error guardando localmente:", e);
      throw e;
    }
  }
};

/**
 * Actualiza el estado de una persona reportada.
 */
export const updateReportStatus = async (reportId, newStatus) => {
  if (isFirebaseConnected && db) {
    try {
      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, { 
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error actualizando en Firestore:", error);
      throw error;
    }
  } else {
    // Modo Local
    try {
      const localData = JSON.parse(localStorage.getItem('venezuela_earthquake_reports')) || [];
      const index = localData.findIndex(r => r.id === reportId);
      if (index !== -1) {
        localData[index].status = newStatus;
        localData[index].updatedAt = new Date().toISOString();
        localStorage.setItem('venezuela_earthquake_reports', JSON.stringify(localData));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.error("Error actualizando localmente:", e);
      throw e;
    }
  }
};

// ==========================================
// SECCIÓN: TABLÓN DE ANUNCIOS (NECESITO/OFREZCO)
// ==========================================

const INITIAL_HELP_ITEMS = [
  {
    id: 'help-mock-1',
    type: 'need',
    category: 'medicines',
    urgency: 'critical',
    title: 'Se necesita Insulina Cristalina',
    description: 'Para paciente diabético de 65 años refugiado en el Gimnasio Cubierto. Requiere 2 frascos de manera urgente.',
    locationName: 'Gimnasio Cubierto, La Guaira',
    contactName: 'Dra. Elena Salazar',
    contactPhone: '+58 412-555-9012',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString()
  },
  {
    id: 'help-mock-2',
    type: 'offer',
    category: 'transport',
    urgency: 'medium',
    title: 'Ofrezco camión 350 para traslado de insumos',
    description: 'Tengo camión disponible para llevar agua, ropa o alimentos desde Caracas hacia zonas afectadas en Vargas. Combustible garantizado.',
    locationName: 'Caracas (salidas desde Plaza Venezuela)',
    contactName: 'Carlos Rivas',
    contactPhone: '+58 416-887-3344',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
  },
  {
    id: 'help-mock-3',
    type: 'need',
    category: 'food_water',
    urgency: 'critical',
    title: 'Agua potable y alimentos no perecederos',
    description: 'El refugio temporal alberga a 45 niños y 30 adultos. Nos estamos quedando sin agua potable para consumo básico.',
    locationName: 'Escuela República del Salvador, Maiquetía',
    contactName: 'Prof. Mario Gómez',
    contactPhone: '+58 424-998-1122',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
  },
  {
    id: 'help-mock-4',
    type: 'offer',
    category: 'shelter',
    urgency: 'low',
    title: 'Hospedaje temporal para familia con niños',
    description: 'Ofrezco una habitación con baño en mi residencia en Maracay para albergar temporalmente a una familia damnificada (máximo 4 personas).',
    locationName: 'El Limón, Maracay',
    contactName: 'Familia Mendoza',
    contactPhone: '+58 412-888-2233',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  }
];

// Inicializar LocalStorage para el tablón si está vacío
if (!localStorage.getItem('venezuela_earthquake_help_board')) {
  localStorage.setItem('venezuela_earthquake_help_board', JSON.stringify(INITIAL_HELP_ITEMS));
}

/**
 * Escucha en tiempo real los anuncios del tablón de ayuda.
 * Cuenta con fallback automático a LocalStorage si fallan los permisos o la conexión de Firestore.
 */
export const subscribeToHelpItems = (onUpdate) => {
  let localCleanup = null;

  const loadLocal = () => {
    try {
      const data = localStorage.getItem('venezuela_earthquake_help_board');
      const list = JSON.parse(data) || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      onUpdate(list);
    } catch (e) {
      console.error("Error al cargar ayuda local:", e);
    }
  };

  const setupLocalListener = () => {
    loadLocal();
    const listener = (e) => {
      if (!e.key || e.key === 'venezuela_earthquake_help_board') {
        loadLocal();
      }
    };
    window.addEventListener('storage', listener);
    localCleanup = () => window.removeEventListener('storage', listener);
  };

  if (isFirebaseConnected && db) {
    try {
      const q = query(collection(db, 'help_board'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
          });
        });
        onUpdate(items);
      }, (error) => {
        console.warn("Firestore subscription failed for help_board. Falling back to LocalStorage:", error);
        setupLocalListener();
      });

      return () => {
        unsub();
        if (localCleanup) localCleanup();
      };
    } catch (err) {
      console.warn("Firestore query failed for help_board. Falling back to LocalStorage:", err);
      setupLocalListener();
      return () => {
        if (localCleanup) localCleanup();
      };
    }
  } else {
    setupLocalListener();
    return () => {
      if (localCleanup) localCleanup();
    };
  }
};

/**
 * Agrega un nuevo anuncio al tablón (solicitud u oferta).
 * Cuenta con fallback automático a LocalStorage si falla la escritura en Firestore.
 */
export const addHelpItem = async (itemData) => {
  const newItem = {
    type: itemData.type,
    category: itemData.category,
    urgency: itemData.urgency || 'low',
    title: itemData.title,
    description: itemData.description,
    locationName: itemData.locationName,
    contactName: itemData.contactName,
    contactPhone: itemData.contactPhone,
    createdAt: isFirebaseConnected ? serverTimestamp() : new Date().toISOString()
  };

  const saveLocal = () => {
    try {
      const localData = JSON.parse(localStorage.getItem('venezuela_earthquake_help_board')) || [];
      const itemWithId = {
        id: 'help-local-' + Date.now(),
        ...newItem,
        createdAt: new Date().toISOString()
      };
      localData.push(itemWithId);
      localStorage.setItem('venezuela_earthquake_help_board', JSON.stringify(localData));
      window.dispatchEvent(new Event('storage'));
      return itemWithId.id;
    } catch (e) {
      console.error("Error guardando anuncio localmente:", e);
      throw e;
    }
  };

  if (isFirebaseConnected && db) {
    try {
      const docRef = await addDoc(collection(db, 'help_board'), newItem);
      return docRef.id;
    } catch (error) {
      console.warn("Error guardando en Firestore help_board (puede deberse a reglas). Usando LocalStorage:", error);
      return saveLocal();
    }
  } else {
    return saveLocal();
  }
};

// ==========================================
// SECCIÓN: BANCO DE SANGRE URGENTE
// ==========================================

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const INITIAL_BLOOD_DATA = {
  donors: [
    {
      id: 'donor-mock-1',
      bloodType: 'O+',
      name: 'Carlos Medina',
      phone: '+58 414-712-3344',
      locationName: 'Catia, Caracas',
      lastDonation: '2025-12-10',
      available: true,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'donor-mock-2',
      bloodType: 'A-',
      name: 'María González',
      phone: '+58 424-987-5566',
      locationName: 'La Guaira',
      lastDonation: '2025-10-05',
      available: true,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 'donor-mock-3',
      bloodType: 'O-',
      name: 'Pedro Ramírez',
      phone: '+58 412-345-7890',
      locationName: 'Maiquetía, Vargas',
      lastDonation: '2025-08-20',
      available: true,
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
    }
  ],
  requests: [
    {
      id: 'request-mock-1',
      bloodType: 'O-',
      urgency: 'critical',
      unitsNeeded: 4,
      hospitalName: 'Hospital Dr. Miguel Pérez Carreño',
      locationName: 'El Paraíso, Caracas',
      patientCondition: 'Politraumatismo severo. Cirugía de emergencia en curso.',
      contactName: 'Dra. Sandra Ríos',
      contactPhone: '+58 212-443-1100',
      createdAt: new Date(Date.now() - 3600000 * 1).toISOString()
    },
    {
      id: 'request-mock-2',
      bloodType: 'A+',
      urgency: 'high',
      unitsNeeded: 2,
      hospitalName: 'Clínica El Ávila',
      locationName: 'San Bernardino, Caracas',
      patientCondition: 'Hemorragia interna post-sismo. Requiere transfusión urgente.',
      contactName: 'Enf. José Morales',
      contactPhone: '+58 212-555-8877',
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      id: 'request-mock-3',
      bloodType: 'B+',
      urgency: 'medium',
      unitsNeeded: 1,
      hospitalName: 'Hospital Vargas',
      locationName: 'San José, Caracas',
      patientCondition: 'Paciente pediátrico 8 años. Intervención programada.',
      contactName: 'Dr. Luis Castillo',
      contactPhone: '+58 212-482-3310',
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
    }
  ]
};

// Inicializar LocalStorage para banco de sangre si está vacío
if (!localStorage.getItem('venezuela_blood_donors')) {
  localStorage.setItem('venezuela_blood_donors', JSON.stringify(INITIAL_BLOOD_DATA.donors));
}
if (!localStorage.getItem('venezuela_blood_requests')) {
  localStorage.setItem('venezuela_blood_requests', JSON.stringify(INITIAL_BLOOD_DATA.requests));
}

/**
 * Escucha donantes de sangre en tiempo real con fallback a LocalStorage.
 */
export const subscribeToBloodDonors = (onUpdate) => {
  let localCleanup = null;

  const loadLocal = () => {
    try {
      const list = JSON.parse(localStorage.getItem('venezuela_blood_donors')) || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      onUpdate(list);
    } catch (e) { console.error(e); }
  };

  const setupLocal = () => {
    loadLocal();
    const listener = (e) => {
      if (!e.key || e.key === 'venezuela_blood_donors') loadLocal();
    };
    window.addEventListener('storage', listener);
    localCleanup = () => window.removeEventListener('storage', listener);
  };

  if (isFirebaseConnected && db) {
    try {
      const q = query(collection(db, 'blood_donors'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        const items = [];
        snap.forEach((doc) => {
          const d = doc.data();
          items.push({ id: doc.id, ...d, createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt });
        });
        onUpdate(items);
      }, () => setupLocal());
      return () => { unsub(); if (localCleanup) localCleanup(); };
    } catch { setupLocal(); return () => { if (localCleanup) localCleanup(); }; }
  } else {
    setupLocal();
    return () => { if (localCleanup) localCleanup(); };
  }
};

/**
 * Escucha solicitudes urgentes de sangre en tiempo real con fallback a LocalStorage.
 */
export const subscribeToBloodRequests = (onUpdate) => {
  let localCleanup = null;

  const loadLocal = () => {
    try {
      const list = JSON.parse(localStorage.getItem('venezuela_blood_requests')) || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      onUpdate(list);
    } catch (e) { console.error(e); }
  };

  const setupLocal = () => {
    loadLocal();
    const listener = (e) => {
      if (!e.key || e.key === 'venezuela_blood_requests') loadLocal();
    };
    window.addEventListener('storage', listener);
    localCleanup = () => window.removeEventListener('storage', listener);
  };

  if (isFirebaseConnected && db) {
    try {
      const q = query(collection(db, 'blood_requests'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        const items = [];
        snap.forEach((doc) => {
          const d = doc.data();
          items.push({ id: doc.id, ...d, createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt });
        });
        onUpdate(items);
      }, () => setupLocal());
      return () => { unsub(); if (localCleanup) localCleanup(); };
    } catch { setupLocal(); return () => { if (localCleanup) localCleanup(); }; }
  } else {
    setupLocal();
    return () => { if (localCleanup) localCleanup(); };
  }
};

/**
 * Registra un nuevo donante de sangre.
 */
export const addBloodDonor = async (data) => {
  const item = {
    bloodType: data.bloodType,
    name: data.name,
    phone: data.phone,
    locationName: data.locationName,
    lastDonation: data.lastDonation || '',
    available: true,
    createdAt: isFirebaseConnected ? serverTimestamp() : new Date().toISOString()
  };

  const saveLocal = () => {
    const list = JSON.parse(localStorage.getItem('venezuela_blood_donors')) || [];
    const withId = { id: 'donor-local-' + Date.now(), ...item, createdAt: new Date().toISOString() };
    list.push(withId);
    localStorage.setItem('venezuela_blood_donors', JSON.stringify(list));
    window.dispatchEvent(new Event('storage'));
    return withId.id;
  };

  if (isFirebaseConnected && db) {
    try {
      const ref = await addDoc(collection(db, 'blood_donors'), item);
      return ref.id;
    } catch { return saveLocal(); }
  }
  return saveLocal();
};

/**
 * Publica una solicitud urgente de sangre desde un hospital o centro de salud.
 */
export const addBloodRequest = async (data) => {
  const item = {
    bloodType: data.bloodType,
    urgency: data.urgency || 'high',
    unitsNeeded: Number(data.unitsNeeded) || 1,
    hospitalName: data.hospitalName,
    locationName: data.locationName,
    patientCondition: data.patientCondition,
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    createdAt: isFirebaseConnected ? serverTimestamp() : new Date().toISOString()
  };

  const saveLocal = () => {
    const list = JSON.parse(localStorage.getItem('venezuela_blood_requests')) || [];
    const withId = { id: 'request-local-' + Date.now(), ...item, createdAt: new Date().toISOString() };
    list.push(withId);
    localStorage.setItem('venezuela_blood_requests', JSON.stringify(list));
    window.dispatchEvent(new Event('storage'));
    return withId.id;
  };

  if (isFirebaseConnected && db) {
    try {
      const ref = await addDoc(collection(db, 'blood_requests'), item);
      return ref.id;
    } catch { return saveLocal(); }
  }
  return saveLocal();
};

/**
 * Elimina una solicitud de sangre por su ID.
 */
export const deleteBloodRequest = async (id) => {
  if (isFirebaseConnected && db) {
    try {
      const { deleteDoc, doc: fsDoc } = await import('firebase/firestore');
      await deleteDoc(fsDoc(db, 'blood_requests', id));
      return;
    } catch (e) {
      console.warn('Error eliminando de Firestore, usando LocalStorage:', e);
    }
  }
  // LocalStorage fallback
  const list = JSON.parse(localStorage.getItem('venezuela_blood_requests')) || [];
  const filtered = list.filter(r => r.id !== id);
  localStorage.setItem('venezuela_blood_requests', JSON.stringify(filtered));
  window.dispatchEvent(new Event('storage'));
};

/**
 * Elimina un donante de sangre por su ID.
 */
export const deleteBloodDonor = async (id) => {
  if (isFirebaseConnected && db) {
    try {
      const { deleteDoc, doc: fsDoc } = await import('firebase/firestore');
      await deleteDoc(fsDoc(db, 'blood_donors', id));
      return;
    } catch (e) {
      console.warn('Error eliminando de Firestore, usando LocalStorage:', e);
    }
  }
  // LocalStorage fallback
  const list = JSON.parse(localStorage.getItem('venezuela_blood_donors')) || [];
  const filtered = list.filter(d => d.id !== id);
  localStorage.setItem('venezuela_blood_donors', JSON.stringify(filtered));
  window.dispatchEvent(new Event('storage'));
};

export { isFirebaseConnected, BLOOD_TYPES };



