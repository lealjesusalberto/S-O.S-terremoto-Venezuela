import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Leer y parsear el archivo .env manualmente
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ Error: No se encontró el archivo .env en la raíz del proyecto.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const config = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    config[key] = value.trim();
  }
});

// Validar que tengamos las credenciales mínimas de Firebase
if (!config.VITE_FIREBASE_API_KEY || !config.VITE_FIREBASE_PROJECT_ID) {
  console.error('❌ Error: Falta configurar Firebase en el archivo .env');
  process.exit(1);
}

console.log(`🔥 Inicializando Firebase para el proyecto: ${config.VITE_FIREBASE_PROJECT_ID}...`);

const firebaseConfig = {
  apiKey: config.VITE_FIREBASE_API_KEY,
  authDomain: config.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: config.VITE_FIREBASE_PROJECT_ID,
  storageBucket: config.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. Cargar reportes extraídos
const scrapedDataPath = path.join(__dirname, '../src/data/scraped_reports.json');
if (!fs.existsSync(scrapedDataPath)) {
  console.error('❌ Error: No se encontró el archivo de reportes extraídos en src/data/scraped_reports.json. Ejecute primero scripts/scrape.js');
  process.exit(1);
}

const reports = JSON.parse(fs.readFileSync(scrapedDataPath, 'utf8'));
console.log(`Cargados ${reports.length} reportes desde el JSON.`);

// Función para descargar una imagen y convertirla a Base64
async function downloadAsBase64(url) {
  if (!url) return null;
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.warn(`⚠️ Advertencia: No se pudo descargar la imagen de ${url}: ${error.message}`);
    return null;
  }
}

// Función para geocodificar usando Nominatim (con delay para respetar límites de la API)
async function geocode(locationName) {
  if (!locationName || locationName === 'Desconocido') {
    return { lat: 10.4806, lng: -66.9036 }; // Caracas por defecto
  }

  // Esperar 1 segundo para no saturar la API libre de OpenStreetMap
  await new Promise(resolve => setTimeout(resolve, 1100));

  try {
    const queryUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName + ', Venezuela')}&limit=1`;
    const response = await axios.get(queryUrl, {
      headers: { 'User-Agent': 'SOS-Venezuela-Importer/1.0' }
    });
    
    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      return { lat: parseFloat(lat), lng: parseFloat(lon) };
    }
    
    // Segundo intento más general
    const backupUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`;
    const backupResponse = await axios.get(backupUrl, {
      headers: { 'User-Agent': 'SOS-Venezuela-Importer/1.0' }
    });
    
    if (backupResponse.data && backupResponse.data.length > 0) {
      const { lat, lon } = backupResponse.data[0];
      return { lat: parseFloat(lat), lng: parseFloat(lon) };
    }
  } catch (error) {
    console.warn(`⚠️ Error geocodificando "${locationName}": ${error.message}`);
  }

  return { lat: 10.4806, lng: -66.9036 }; // Default Caracas
}

async function importReports() {
  const reportsCollection = collection(db, 'reports');
  let importedCount = 0;
  let skippedCount = 0;

  // Obtener reportes existentes en Firestore para evitar duplicados
  const existingNames = new Set();
  try {
    const snapshot = await getDocs(reportsCollection);
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.name) {
        existingNames.add(data.name.toLowerCase().trim());
      }
    });
    console.log(`Se encontraron ${existingNames.size} nombres registrados previamente en la base de datos.`);
  } catch (error) {
    console.error('❌ Error obteniendo registros existentes de Firestore:', error);
    process.exit(1);
  }

  for (const report of reports) {
    const nameKey = report.name.toLowerCase().trim();
    if (existingNames.has(nameKey)) {
      console.log(`⏩ Omitiendo duplicado: "${report.name}" ya existe en Firestore.`);
      skippedCount++;
      continue;
    }

    console.log(`\n========================================`);
    console.log(`Procesando: "${report.name}"`);
    
    // Geocodificar ubicación
    console.log(`Geocodificando ubicación: "${report.locationName}"...`);
    const location = await geocode(report.locationName);
    console.log(`📍 Coordenadas obtenidas: [${location.lat}, ${location.lng}]`);

    // Descargar imagen y convertir a Base64
    let photoBase64 = null;
    if (report.photoUrl) {
      console.log(`Descargando e integrando imagen de: ${report.photoUrl}...`);
      photoBase64 = await downloadAsBase64(report.photoUrl);
      if (photoBase64) {
        console.log(`📸 Imagen convertida a Base64 con éxito (${Math.round(photoBase64.length / 1024)} KB)`);
      }
    }

    // Crear objeto para Firestore
    const firestoreReport = {
      name: report.name,
      phone: '+58 000-000-0000', // Teléfono vacío de marcador de posición para registros externos
      status: report.status || 'missing',
      location: location,
      locationName: report.locationName,
      description: report.description || 'Sin descripción adicional.',
      photo: photoBase64,
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(reportsCollection, firestoreReport);
      console.log(`✅ Guardado con éxito. ID en Firestore: ${docRef.id}`);
      existingNames.add(nameKey);
      importedCount++;
    } catch (error) {
      console.error(`❌ Error al subir a Firestore:`, error);
    }
  }

  console.log(`\n========================================`);
  console.log(`🎉 Proceso completado.`);
  console.log(`📥 Importados con éxito: ${importedCount}`);
  console.log(`⏩ Duplicados omitidos: ${skippedCount}`);
}

importReports();
