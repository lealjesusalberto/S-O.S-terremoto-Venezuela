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

export { isFirebaseConnected };
