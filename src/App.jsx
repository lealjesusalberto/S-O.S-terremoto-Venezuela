import React, { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  useMap, 
  useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  subscribeToReports, 
  addReport, 
  updateReportStatus, 
  subscribeToHelpItems,
  addHelpItem,
  subscribeToBloodDonors,
  subscribeToBloodRequests,
  addBloodDonor,
  addBloodRequest,
  deleteBloodRequest,
  deleteBloodDonor,
  BLOOD_TYPES,
  isFirebaseConnected 
} from './firebase';
import { 
  Search, 
  Phone, 
  MapPin, 
  UserPlus, 
  List, 
  AlertTriangle, 
  Heart, 
  CheckCircle, 
  Clock, 
  Plus, 
  Info,
  ArrowRight,
  User,
  Camera,
  Trash2,
  Truck,
  Home,
  Activity,
  ShieldAlert,
  MessageSquare,
  X,
  Droplets,
  Hospital,
  BadgeAlert,
  Syringe
} from 'lucide-react';

// Generar Marcador personalizado usando Leaflet DivIcon para evitar URLs rotas de assets
const createCustomIcon = (status) => {
  let colorClass = 'missing';
  if (status === 'safe') colorClass = 'safe';
  if (status === 'located') colorClass = 'located';
  if (status === 'hospitalized') colorClass = 'hospitalized';
  
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="marker-pin ${colorClass}"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
};

// Componente controlador del mapa para re-centrar suavemente
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 12, {
        animate: true,
        duration: 1.2
      });
    }
  }, [center, zoom, map]);
  return null;
}

// Mini-mapa selector para definir la ubicación del reporte en el formulario
function FormLocationSelector({ position, setPosition }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position ? (
    <Marker position={position} icon={createCustomIcon('missing')} />
  ) : null;
}

export default function App() {
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'map' | 'add'
  const [selectedReport, setSelectedReport] = useState(null);
  const [mapCenter, setMapCenter] = useState([10.4806, -66.9036]); // Caracas por defecto
  const [mapZoom, setMapZoom] = useState(7);
  
  // Filtros y búsquedas
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Formulario de Registro
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('missing');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalDetails, setHospitalDetails] = useState('');
  const [cedula, setCedula] = useState('');
  const [photo, setPhoto] = useState(null); // String Base64 comprimida
  const [formPosition, setFormPosition] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Estados para el Tablón de Ayuda
  const [helpItems, setHelpItems] = useState([]);
  const [helpSearchQuery, setHelpSearchQuery] = useState('');
  const [helpCategoryFilter, setHelpCategoryFilter] = useState('all');
  const [helpTypeFilter, setHelpTypeFilter] = useState('all'); // 'all' | 'need' | 'offer'
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Formulario de Anuncio del Tablón
  const [helpTitle, setHelpTitle] = useState('');
  const [helpDescription, setHelpDescription] = useState('');
  const [helpType, setHelpType] = useState('need'); // 'need' | 'offer'
  const [helpCategory, setHelpCategory] = useState('medicines');
  const [helpUrgency, setHelpUrgency] = useState('low'); // 'low' | 'medium' | 'critical'
  const [helpLocationName, setHelpLocationName] = useState('');
  const [helpContactName, setHelpContactName] = useState('');
  const [helpContactPhone, setHelpContactPhone] = useState('');

  // Estado de búsqueda de geocodificación
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const fileInputRef = useRef(null);

  // Escuchar reportes en tiempo real
  useEffect(() => {
    const unsubscribe = subscribeToReports((data) => {
      setReports(data);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Escuchar anuncios del tablón en tiempo real
  useEffect(() => {
    const unsubscribe = subscribeToHelpItems((data) => {
      setHelpItems(data);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // === BANCO DE SANGRE ===
  const [bloodDonors, setBloodDonors] = useState([]);
  const [bloodRequests, setBloodRequests] = useState([]);
  const [bloodSubTab, setBloodSubTab] = useState('requests'); // 'requests' | 'donors'
  const [bloodTypeFilter, setBloodTypeFilter] = useState('all');
  const [isBloodDonorModalOpen, setIsBloodDonorModalOpen] = useState(false);
  const [isBloodRequestModalOpen, setIsBloodRequestModalOpen] = useState(false);

  // Formulario donante
  const [donorBloodType, setDonorBloodType] = useState('O+');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donorLocation, setDonorLocation] = useState('');
  const [donorLastDonation, setDonorLastDonation] = useState('');

  // Formulario solicitud hospital
  const [reqBloodType, setReqBloodType] = useState('O-');
  const [reqUrgency, setReqUrgency] = useState('critical');
  const [reqUnits, setReqUnits] = useState(1);
  const [reqHospital, setReqHospital] = useState('');
  const [reqLocation, setReqLocation] = useState('');
  const [reqCondition, setReqCondition] = useState('');
  const [reqContactName, setReqContactName] = useState('');
  const [reqContactPhone, setReqContactPhone] = useState('');

  useEffect(() => {
    // Limpiar entradas de prueba locales (ids que empiezan con 'request-local-' o 'donor-local-')
    try {
      const reqs = JSON.parse(localStorage.getItem('venezuela_blood_requests') || '[]');
      const cleanReqs = reqs.filter(r => !r.id.startsWith('request-local-'));
      localStorage.setItem('venezuela_blood_requests', JSON.stringify(cleanReqs));

      const donors = JSON.parse(localStorage.getItem('venezuela_blood_donors') || '[]');
      const cleanDonors = donors.filter(d => !d.id.startsWith('donor-local-'));
      localStorage.setItem('venezuela_blood_donors', JSON.stringify(cleanDonors));
    } catch(e) { /* ignorar */ }

    const unsub1 = subscribeToBloodDonors(setBloodDonors);
    const unsub2 = subscribeToBloodRequests(setBloodRequests);
    return () => {
      if (unsub1) unsub1();
      if (unsub2) unsub2();
    };
  }, []);


  // Procesar y comprimir la imagen en el cliente usando HTML5 Canvas a Base64
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Por favor seleccione un archivo de imagen válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; // Redimensionar para mantener el documento Firestore ligero
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a JPEG comprimido (calidad 0.7)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setPhoto(compressedBase64);
        setFormError('');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Buscar dirección escrita por texto (Geocodificación con Nominatim API libre)
  const handleSearchLocation = async () => {
    if (!locationName) {
      alert('Por favor escribe un lugar o dirección primero (Ej: Chacao, Caracas).');
      return;
    }

    setIsSearchingLocation(true);
    setFormError('');
    try {
      // Hacemos la consulta restringiendo los resultados a Venezuela para mayor precisión
      const queryUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName + ', Venezuela')}&limit=1`;
      const response = await fetch(queryUrl, {
        headers: {
          'Accept-Language': 'es'
        }
      });
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newPos = { lat: parseFloat(lat), lng: parseFloat(lon) };
        setFormPosition(newPos);
      } else {
        // Segundo intento de búsqueda general por si no coincide con el sufijo "Venezuela"
        const backupUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`;
        const responseBackup = await fetch(backupUrl, {
          headers: {
            'Accept-Language': 'es'
          }
        });
        const dataBackup = await responseBackup.json();

        if (dataBackup && dataBackup.length > 0) {
          const { lat, lon } = dataBackup[0];
          const newPos = { lat: parseFloat(lat), lng: parseFloat(lon) };
          setFormPosition(newPos);
        } else {
          setFormError('No pudimos ubicar la dirección ingresada. Intenta escribir nombres de ciudades, estados o avenidas más conocidos (ej. "Altamira, Caracas") o márcalo directamente haciendo clic en el mapa.');
        }
      }
    } catch (error) {
      console.error('Error en geocodificación:', error);
      setFormError('Error al conectar con el servidor de mapas para buscar la dirección. Por favor marque la ubicación manualmente en el mapa.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // Manejar el submit del formulario
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess(false);

    if (!name || !phone || !locationName || !description) {
      setFormError('Por favor complete todos los campos obligatorios.');
      return;
    }

    if (status === 'hospitalized' && !hospitalName) {
      setFormError('Por favor indique el nombre del hospital donde se encuentra la persona.');
      return;
    }

    if (!formPosition) {
      setFormError('Por favor marque la ubicación aproximada en el mapa del formulario haciendo clic o escribiendo la dirección y presionando "Ubicar".');
      return;
    }

    setIsSubmitting(true);
    try {
      await addReport({
        name,
        phone,
        status,
        locationName,
        description,
        photo,
        hospitalName: status === 'hospitalized' ? hospitalName : '',
        hospitalDetails: status === 'hospitalized' ? hospitalDetails : '',
        cedula,
        location: {
          lat: formPosition.lat,
          lng: formPosition.lng
        }
      });

      // Limpiar formulario
      setName('');
      setPhone('');
      setStatus('missing');
      setLocationName('');
      setDescription('');
      setHospitalName('');
      setHospitalDetails('');
      setCedula('');
      setPhoto(null);
      setFormPosition(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      setFormSuccess(true);
      setActiveTab('grid'); // Regresar a la vista de cuadrícula
    } catch (err) {
      setFormError('Hubo un error al enviar el reporte: ' + err.message);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enviar anuncio al tablón de ayuda
  const handleSubmitHelpItem = async (e) => {
    e.preventDefault();
    if (!helpTitle || !helpDescription || !helpLocationName || !helpContactName || !helpContactPhone) {
      alert('Por favor complete todos los campos obligatorios.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addHelpItem({
        type: helpType,
        category: helpCategory,
        urgency: helpUrgency,
        title: helpTitle,
        description: helpDescription,
        locationName: helpLocationName,
        contactName: helpContactName,
        contactPhone: helpContactPhone
      });

      // Limpiar formulario
      setHelpTitle('');
      setHelpDescription('');
      setHelpType('need');
      setHelpCategory('medicines');
      setHelpUrgency('low');
      setHelpLocationName('');
      setHelpContactName('');
      setHelpContactPhone('');
      setIsHelpModalOpen(false);
      
      alert('Anuncio publicado con éxito en el tablón.');
    } catch (err) {
      alert('Hubo un error al enviar el anuncio: ' + err.message);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cambiar el estado de un reporte
  const handleStatusChange = async (reportId, newStatus) => {
    try {
      await updateReportStatus(reportId, newStatus);
    } catch (err) {
      alert('Error al actualizar el estado: ' + err.message);
    }
  };

  // Seleccionar reporte de la lista, cambiar al mapa y centrarlo
  const handleSelectReport = (report) => {
    setSelectedReport(report);
    setMapCenter([report.location.lat, report.location.lng]);
    setMapZoom(14); // Zoom cercano
    setActiveTab('map'); // Cambiar automáticamente al mapa
  };

  // Filtrar reportes
  const filteredReports = reports.filter((report) => {
    const matchesSearch = 
      report.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      report.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.hospitalName && report.hospitalName.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Filtrar anuncios del tablón
  const filteredHelpItems = helpItems.filter((item) => {
    const matchesSearch = 
      item.title.toLowerCase().includes(helpSearchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(helpSearchQuery.toLowerCase()) ||
      item.locationName.toLowerCase().includes(helpSearchQuery.toLowerCase()) ||
      item.contactName.toLowerCase().includes(helpSearchQuery.toLowerCase());
      
    const matchesCategory = helpCategoryFilter === 'all' || item.category === helpCategoryFilter;
    const matchesType = helpTypeFilter === 'all' || item.type === helpTypeFilter;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  const getStatusText = (statusVal) => {
    switch(statusVal) {
      case 'missing': return 'Desaparecido';
      case 'located': return 'Ubicado con necesidad';
      case 'safe': return 'A Salvo / Seguro';
      case 'hospitalized': return 'Hospitalizado';
      default: return statusVal;
    }
  };

  const getRelativeTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const seconds = Math.floor((new Date() - date) / 1000);
      
      let interval = Math.floor(seconds / 31536000);
      if (interval >= 1) return `hace ${interval} año${interval > 1 ? 's' : ''}`;
      
      interval = Math.floor(seconds / 2592000);
      if (interval >= 1) return `hace ${interval} mes${interval > 1 ? 'es' : ''}`;
      
      interval = Math.floor(seconds / 86400);
      if (interval >= 1) return `hace ${interval} día${interval > 1 ? 's' : ''}`;
      
      interval = Math.floor(seconds / 3600);
      if (interval >= 1) return `hace ${interval} hora${interval > 1 ? 's' : ''}`;
      
      interval = Math.floor(seconds / 60);
      if (interval >= 1) return `hace ${interval} minuto${interval > 1 ? 's' : ''}`;
      
      return 'hace unos momentos';
    } catch (e) {
      return '';
    }
  };

  // Calcular estadísticas para el dashboard
  const totalCount = reports.length;
  const missingCount = reports.filter(r => r.status === 'missing').length;
  const hospitalizedCount = reports.filter(r => r.status === 'hospitalized').length;
  const safeCount = reports.filter(r => r.status === 'safe').length;

  // Filtros banco de sangre
  const filteredBloodRequests = bloodRequests.filter(r =>
    bloodTypeFilter === 'all' || r.bloodType === bloodTypeFilter
  );
  const filteredBloodDonors = bloodDonors.filter(d =>
    bloodTypeFilter === 'all' || d.bloodType === bloodTypeFilter
  );

  // Enviar registro de donante
  const handleSubmitDonor = async (e) => {
    e.preventDefault();
    if (!donorName || !donorPhone || !donorLocation) {
      alert('Por favor completa todos los campos obligatorios.');
      return;
    }
    setIsSubmitting(true);
    try {
      await addBloodDonor({
        bloodType: donorBloodType,
        name: donorName,
        phone: donorPhone,
        locationName: donorLocation,
        lastDonation: donorLastDonation
      });
      setDonorName(''); setDonorPhone(''); setDonorLocation(''); setDonorLastDonation('');
      setIsBloodDonorModalOpen(false);
      alert('¡Gracias! Tu registro como donante fue guardado.');
    } catch (err) {
      alert('Error al registrar: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar una solicitud de sangre
  const handleDeleteBloodRequest = async (id) => {
    if (!window.confirm('¿Eliminar esta solicitud de sangre?')) return;
    try {
      await deleteBloodRequest(id);
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  // Eliminar un donante de sangre
  const handleDeleteBloodDonor = async (id) => {
    if (!window.confirm('¿Eliminar este donante de la lista?')) return;
    try {
      await deleteBloodDonor(id);
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  // Enviar solicitud de sangre (hospital)
  const handleSubmitBloodRequest = async (e) => {
    e.preventDefault();
    if (!reqHospital || !reqLocation || !reqCondition || !reqContactName || !reqContactPhone) {
      alert('Por favor completa todos los campos obligatorios.');
      return;
    }
    setIsSubmitting(true);
    try {
      await addBloodRequest({
        bloodType: reqBloodType,
        urgency: reqUrgency,
        unitsNeeded: reqUnits,
        hospitalName: reqHospital,
        locationName: reqLocation,
        patientCondition: reqCondition,
        contactName: reqContactName,
        contactPhone: reqContactPhone
      });
      setReqHospital(''); setReqLocation(''); setReqCondition('');
      setReqContactName(''); setReqContactPhone('');
      setIsBloodRequestModalOpen(false);
      alert('Solicitud de sangre publicada con éxito.');
    } catch (err) {
      alert('Error al publicar: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container">
      {/* Banner de Modo Demo/Local si no hay Firebase */}
      {!isFirebaseConnected && (
        <div className="demo-banner">
          <Info size={16} />
          <span>Corriendo en <strong>Modo Local (LocalStorage)</strong>. Conecta tu base de datos configurando tu archivo <code>.env</code></span>
        </div>
      )}

      {/* Header Principal */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">VE</div>
          <div>
            <h1 className="brand-title">S.O.S. Terremoto Venezuela</h1>
            <span className="brand-subtitle">Plataforma de Apoyo y Registro</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="emergency-badge">
            <AlertTriangle size={16} />
            <span>Sismo de Emergencia</span>
          </div>
        </div>
      </header>

      {/* Layout de Pestañas de Ancho Completo */}
      <main className="main-layout">
        {/* Navegación por pestañas */}
        <nav className="tab-nav">
          <button 
            className={`tab-btn ${activeTab === 'grid' ? 'active' : ''}`}
            onClick={() => setActiveTab('grid')}
          >
            <List size={18} />
            <span>Ver Desaparecidos</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <MapPin size={18} />
            <span>Mapa Interactivo</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'help' ? 'active' : ''}`}
            onClick={() => setActiveTab('help')}
          >
            <Clock size={18} />
            <span>Tablón de Ayuda</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'blood' ? 'active' : ''}`}
            onClick={() => setActiveTab('blood')}
            style={activeTab === 'blood' ? { borderColor: '#dc2626', color: '#fca5a5', background: 'rgba(220,38,38,0.12)' } : {}}
          >
            <Droplets size={18} />
            <span>Banco de Sangre</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            <Plus size={18} />
            <span>Reportar Persona</span>
          </button>
        </nav>

        {/* Contenido de la pestaña activa */}
        <section className="tab-content">
          
          {/* PESTAÑA: Grid de Tarjetas (Principal) */}
          {activeTab === 'grid' && (
            <div className="grid-container-inner">
              
              {/* Dashboard Panel de Estadísticas Premium */}
              <div className="stats-grid">
                <div className="stat-card" onClick={() => setStatusFilter('all')} style={{ cursor: 'pointer' }}>
                  <div className="stat-icon-wrapper total">
                    <List size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{totalCount}</span>
                    <span className="stat-label">Total Reportes</span>
                  </div>
                </div>

                <div className="stat-card" onClick={() => setStatusFilter('missing')} style={{ cursor: 'pointer' }}>
                  <div className="stat-icon-wrapper missing">
                    <AlertTriangle size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{missingCount}</span>
                    <span className="stat-label">Desaparecidos</span>
                  </div>
                </div>

                <div className="stat-card" onClick={() => setStatusFilter('hospitalized')} style={{ cursor: 'pointer' }}>
                  <div className="stat-icon-wrapper hospitalized">
                    <Heart size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{hospitalizedCount}</span>
                    <span className="stat-label">En Hospitales</span>
                  </div>
                </div>

                <div className="stat-card" onClick={() => setStatusFilter('safe')} style={{ cursor: 'pointer' }}>
                  <div className="stat-icon-wrapper safe">
                    <CheckCircle size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{safeCount}</span>
                    <span className="stat-label">A Salvo / Seguro</span>
                  </div>
                </div>
              </div>

              {/* Controles de Búsqueda y Filtros */}
              <div className="grid-header-controls">
                <div className="search-box">
                  <Search className="search-icon" size={18} />
                  <input 
                    type="text" 
                    className="form-control search-input" 
                    placeholder="Buscar por nombre, hospital, ciudad..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-row">
                  <button 
                    className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    Todos ({reports.length})
                  </button>
                  <button 
                    className={`filter-btn ${statusFilter === 'missing' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('missing')}
                  >
                    Desaparecidos ({missingCount})
                  </button>
                  <button 
                    className={`filter-btn ${statusFilter === 'hospitalized' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('hospitalized')}
                  >
                    Hospitalizados ({hospitalizedCount})
                  </button>
                  <button 
                    className={`filter-btn ${statusFilter === 'located' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('located')}
                  >
                    Ubicados con necesidad ({reports.filter(r => r.status === 'located').length})
                  </button>
                  <button 
                    className={`filter-btn ${statusFilter === 'safe' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('safe')}
                  >
                    A Salvo ({safeCount})
                  </button>
                </div>
              </div>

              {/* Grid responsivo */}
              <div className="reports-grid">
                {filteredReports.length === 0 ? (
                  <div className="no-reports">
                    <p>No se encontraron reportes que coincidan con los filtros de búsqueda.</p>
                  </div>
                ) : (
                  filteredReports.map((report) => (
                    <article 
                      key={report.id} 
                      className={`report-card ${report.status} ${selectedReport?.id === report.id ? 'selected' : ''}`}
                      onClick={() => handleSelectReport(report)}
                    >
                      {/* Cabecera de foto */}
                      <div className="card-image-container">
                        {report.photo ? (
                          <img src={report.photo} alt={report.name} className="card-image" />
                        ) : (
                          <div className="card-image-placeholder">
                            <User size={48} />
                            <span>Sin foto disponible</span>
                          </div>
                        )}
                      </div>

                      {/* Cuerpo de información */}
                      <div className="card-content">
                        <div className="card-header">
                          <h3 className="card-name">
                            {report.name}
                            {report.cedula && (
                              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: '500', display: 'block', marginTop: '0.25rem' }}>
                                C.I. {report.cedula}
                              </span>
                            )}
                          </h3>
                          <span className={`status-badge ${report.status}`}>
                            {getStatusText(report.status)}
                          </span>
                        </div>

                        <div className="card-location">
                          <MapPin size={14} style={{ color: 'hsl(var(--color-primary-hover))' }} />
                          <span>{report.locationName}</span>
                        </div>

                        {/* Etiqueta especial si está hospitalizado */}
                        {report.status === 'hospitalized' && report.hospitalName && (
                          <div className="card-hospital-tag">
                            <Heart size={12} />
                            <span>Internado en: {report.hospitalName}</span>
                          </div>
                        )}

                        <p className="card-description">
                          {report.status === 'hospitalized' && report.hospitalDetails 
                            ? `[Detalle médico: ${report.hospitalDetails}] - ${report.description}` 
                            : report.description
                          }
                        </p>

                        <div className="card-footer" onClick={(e) => e.stopPropagation()}>
                          <a href={`tel:${report.phone}`} className="card-phone">
                            <Phone size={14} />
                            <span>{report.phone}</span>
                          </a>

                          <select 
                            className="status-select"
                            value={report.status}
                            onChange={(e) => handleStatusChange(report.id, e.target.value)}
                          >
                            <option value="missing">Desaparecido</option>
                            <option value="hospitalized">Hospitalizado</option>
                            <option value="located">Ubicado con necesidad</option>
                            <option value="safe">A Salvo / Seguro</option>
                          </select>
                        </div>

                        <div className="card-time" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                          <Clock size={12} />
                          <span>{getRelativeTime(report.createdAt)}</span>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}

          {/* PESTAÑA: Mapa Interactivo a Pantalla Completa */}
          {activeTab === 'map' && (
            <div className="map-tab-container">
              <MapContainer 
                center={mapCenter} 
                zoom={mapZoom} 
                className="map-container"
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Controladores de re-centrado suave */}
                <MapController center={mapCenter} zoom={mapZoom} />

                {/* Marcadores de Personas Reportadas */}
                {filteredReports.map((report) => (
                  <Marker 
                    key={report.id} 
                    position={[report.location.lat, report.location.lng]}
                    icon={createCustomIcon(report.status)}
                    eventHandlers={{
                      click: () => {
                        setSelectedReport(report);
                      }
                    }}
                  >
                    <Popup>
                      <div className="popup-details">
                        {/* Cabecera de foto en el popup */}
                        <div className="popup-image-container">
                          {report.photo ? (
                            <img src={report.photo} alt={report.name} className="popup-image" />
                          ) : (
                            <div className="card-image-placeholder" style={{ height: '100%' }}>
                              <User size={32} />
                              <span style={{ fontSize: '0.75rem' }}>Sin foto</span>
                            </div>
                          )}
                        </div>

                        <div className="popup-info-body">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="popup-name">
                              {report.name}
                              {report.cedula && (
                                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: '500', display: 'block', marginTop: '0.1rem' }}>
                                  C.I. {report.cedula}
                                </span>
                              )}
                            </span>
                            <span className={`status-badge ${report.status}`} style={{ transform: 'scale(0.85)', transformOrigin: 'right' }}>
                              {getStatusText(report.status)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: '600' }}>
                            <MapPin size={12} style={{ color: 'hsl(var(--color-primary-hover))' }} />
                            <span>{report.locationName}</span>
                          </div>

                          {report.status === 'hospitalized' && report.hospitalName && (
                            <div className="card-hospital-tag" style={{ margin: '0.2rem 0' }}>
                              <Heart size={10} />
                              <span>{report.hospitalName}</span>
                            </div>
                          )}

                          <p className="popup-desc">
                            {report.status === 'hospitalized' && report.hospitalDetails 
                              ? `Condición: ${report.hospitalDetails}. ${report.description}`
                              : report.description
                            }
                          </p>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                            <a href={`tel:${report.phone}`} className="card-phone" style={{ fontSize: '0.8rem' }}>
                              <Phone size={12} />
                              <span>{report.phone}</span>
                            </a>
                            
                            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Clock size={10} />
                              {getRelativeTime(report.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}

          {/* PESTAÑA: Tablón de Ayuda */}
          {activeTab === 'help' && (
            <div className="grid-container-inner">
              <div className="help-form-toggle-bar">
                <button 
                  className="btn btn-primary btn-new-item"
                  onClick={() => setIsHelpModalOpen(true)}
                >
                  <Plus size={16} />
                  <span>Publicar Anuncio</span>
                </button>
              </div>

              {/* Controles de Búsqueda y Filtros */}
              <div className="grid-header-controls">
                <div className="search-box">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Buscar en el tablón (medicinas, camión, etc.)..."
                    value={helpSearchQuery}
                    onChange={(e) => setHelpSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-row">
                  <button 
                    className={`filter-btn ${helpTypeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setHelpTypeFilter('all')}
                  >
                    Todos
                  </button>
                  <button 
                    className={`filter-btn ${helpTypeFilter === 'need' ? 'active' : ''}`}
                    onClick={() => setHelpTypeFilter('need')}
                  >
                    Necesito
                  </button>
                  <button 
                    className={`filter-btn ${helpTypeFilter === 'offer' ? 'active' : ''}`}
                    onClick={() => setHelpTypeFilter('offer')}
                  >
                    Ofrezco
                  </button>
                </div>
              </div>

              {/* Categorías de Ayuda */}
              <div className="help-categories-filter">
                <button 
                  className={`category-chip ${helpCategoryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setHelpCategoryFilter('all')}
                >
                  <span>Todos</span>
                </button>
                <button 
                  className={`category-chip ${helpCategoryFilter === 'medicines' ? 'active' : ''}`}
                  onClick={() => setHelpCategoryFilter('medicines')}
                >
                  <Activity size={14} />
                  <span>Medicinas</span>
                </button>
                <button 
                  className={`category-chip ${helpCategoryFilter === 'food_water' ? 'active' : ''}`}
                  onClick={() => setHelpCategoryFilter('food_water')}
                >
                  <Heart size={14} />
                  <span>Alimentos / Agua</span>
                </button>
                <button 
                  className={`category-chip ${helpCategoryFilter === 'transport' ? 'active' : ''}`}
                  onClick={() => setHelpCategoryFilter('transport')}
                >
                  <Truck size={14} />
                  <span>Transporte</span>
                </button>
                <button 
                  className={`category-chip ${helpCategoryFilter === 'tools_rescue' ? 'active' : ''}`}
                  onClick={() => setHelpCategoryFilter('tools_rescue')}
                >
                  <ShieldAlert size={14} />
                  <span>Rescate / Herramientas</span>
                </button>
                <button 
                  className={`category-chip ${helpCategoryFilter === 'shelter' ? 'active' : ''}`}
                  onClick={() => setHelpCategoryFilter('shelter')}
                >
                  <Home size={14} />
                  <span>Refugio</span>
                </button>
                <button 
                  className={`category-chip ${helpCategoryFilter === 'other' ? 'active' : ''}`}
                  onClick={() => setHelpCategoryFilter('other')}
                >
                  <MessageSquare size={14} />
                  <span>Otros</span>
                </button>
              </div>

              {/* Grid de Anuncios */}
              <div className="help-grid">
                {filteredHelpItems.length === 0 ? (
                  <div className="no-reports">
                    No se encontraron anuncios que coincidan con los filtros seleccionados.
                  </div>
                ) : (
                  filteredHelpItems.map((item) => (
                    <div key={item.id} className={`help-card ${item.type}`}>
                      <div className="help-card-header">
                        <span className={`help-type-tag ${item.type}`}>
                          {item.type === 'need' ? 'Necesito' : 'Ofrezco'}
                        </span>
                        
                        {item.urgency === 'critical' && (
                          <span className="urgency-badge critical">¡Crítico!</span>
                        )}
                        {item.urgency === 'medium' && (
                          <span className="urgency-badge medium">Prioridad Media</span>
                        )}
                        {item.urgency === 'low' && (
                          <span className="urgency-badge low">Bajo</span>
                        )}
                      </div>

                      <h3 className="help-card-title">{item.title}</h3>
                      <p className="help-card-desc">{item.description}</p>

                      <div className="help-card-details">
                        <div className="help-detail-item">
                          <MapPin size={14} />
                          <span>{item.locationName}</span>
                        </div>
                        <div className="help-detail-item">
                          <User size={14} />
                          <span>Contacto: {item.contactName}</span>
                        </div>
                        <div className="help-detail-item">
                          <Clock size={14} />
                          <span>{getRelativeTime(item.createdAt)}</span>
                        </div>
                      </div>

                      <div className="help-card-actions has-two">
                        <a href={`tel:${item.contactPhone}`} className="btn-help-action call">
                          <Phone size={12} />
                          <span>Llamar</span>
                        </a>
                        <a 
                          href={`https://wa.me/${item.contactPhone.replace(/[^\d]/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn-help-action"
                          style={{ borderColor: 'rgba(16, 185, 129, 0.3)', color: '#a7f3d0' }}
                        >
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* PESTAÑA: Banco de Sangre */}
          {activeTab === 'blood' && (
            <div className="grid-container-inner">
              <div className="blood-bank-layout">

                {/* Hero Banner */}
                <div className="blood-hero">
                  <div className="blood-hero-text">
                    <h2>🩸 Banco de Sangre Urgente</h2>
                    <p>
                      Conectamos donantes de sangre con hospitales en tiempo real.
                      Si puedes donar o tu hospital necesita sangre urgente, actúa ahora.
                    </p>
                  </div>
                  <div className="blood-hero-actions">
                    <button className="btn btn-donor" onClick={() => setIsBloodDonorModalOpen(true)}>
                      <Droplets size={16} />
                      Soy Donante
                    </button>
                    <button className="btn btn-request-blood" onClick={() => setIsBloodRequestModalOpen(true)}>
                      <Hospital size={16} />
                      Hospital Necesita Sangre
                    </button>
                  </div>
                </div>

                {/* Stats rápidas */}
                <div className="blood-stats-row">
                  <div className="blood-stat">
                    <span className="blood-stat-value red">{bloodRequests.filter(r => r.urgency === 'critical').length}</span>
                    <span className="blood-stat-label">Solicitudes Críticas</span>
                  </div>
                  <div className="blood-stat">
                    <span className="blood-stat-value red">{bloodRequests.length}</span>
                    <span className="blood-stat-label">Hospitales Solicitando</span>
                  </div>
                  <div className="blood-stat">
                    <span className="blood-stat-value blue">{bloodDonors.length}</span>
                    <span className="blood-stat-label">Donantes Registrados</span>
                  </div>
                </div>

                {/* Sub-tabs y Filtros */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div className="blood-sub-nav">
                    <button
                      className={`blood-sub-btn ${bloodSubTab === 'requests' ? 'active' : ''}`}
                      onClick={() => setBloodSubTab('requests')}
                    >
                      <BadgeAlert size={16} />
                      Solicitudes Urgentes ({bloodRequests.length})
                    </button>
                    <button
                      className={`blood-sub-btn donors ${bloodSubTab === 'donors' ? 'active' : ''}`}
                      onClick={() => setBloodSubTab('donors')}
                    >
                      <Droplets size={16} />
                      Donantes Disponibles ({bloodDonors.length})
                    </button>
                  </div>
                </div>

                {/* Filtro por tipo de sangre */}
                <div className="blood-type-filter">
                  <button className={`blood-chip ${bloodTypeFilter === 'all' ? 'active' : ''}`} onClick={() => setBloodTypeFilter('all')}>
                    Todos
                  </button>
                  {BLOOD_TYPES.map(bt => (
                    <button key={bt} className={`blood-chip ${bloodTypeFilter === bt ? 'active' : ''}`} onClick={() => setBloodTypeFilter(bt)}>
                      {bt}
                    </button>
                  ))}
                </div>

                {/* Grid de Solicitudes */}
                {bloodSubTab === 'requests' && (
                  <div className="blood-grid">
                    {filteredBloodRequests.length === 0 ? (
                      <div className="no-reports">No hay solicitudes de sangre activas con los filtros seleccionados.</div>
                    ) : (
                      filteredBloodRequests.map(req => (
                        <div key={req.id} className={`blood-request-card ${req.urgency}`}>
                          <div className="blood-card-top">
                            <div className={`blood-type-badge request-type`}>{req.bloodType}</div>
                            <div className="blood-card-top-info">
                              <span className={`blood-urgency-tag ${req.urgency}`}>
                                {req.urgency === 'critical' ? '⚠ CRÍTICO' : req.urgency === 'high' ? 'Alta Prioridad' : 'Media Prioridad'}
                              </span>
                              <span className="blood-card-hospital">{req.hospitalName}</span>
                            </div>
                          </div>

                          <div className="blood-units-info">
                            <Syringe size={14} />
                            <span>Se necesitan <strong>{req.unitsNeeded} unidad{req.unitsNeeded > 1 ? 'es' : ''}</strong> de sangre tipo <strong>{req.bloodType}</strong></span>
                          </div>

                          <div className="blood-condition">{req.patientCondition}</div>

                          <div className="blood-card-meta">
                            <div className="blood-meta-item">
                              <MapPin size={13} />
                              <span>{req.locationName}</span>
                            </div>
                            <div className="blood-meta-item">
                              <User size={13} />
                              <span>Contacto: {req.contactName}</span>
                            </div>
                            <div className="blood-meta-item">
                              <Clock size={13} />
                              <span>{getRelativeTime(req.createdAt)}</span>
                            </div>
                          </div>

                          <div className="blood-card-actions">
                            <a href={`tel:${req.contactPhone}`} className="btn-blood-call">
                              <Phone size={13} />
                              Llamar Ahora
                            </a>
                            <a href={`https://wa.me/${req.contactPhone.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn-blood-wa">
                              WhatsApp
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Grid de Donantes */}
                {bloodSubTab === 'donors' && (
                  <div className="blood-grid">
                    {filteredBloodDonors.length === 0 ? (
                      <div className="no-reports">No hay donantes registrados con los filtros seleccionados.</div>
                    ) : (
                      filteredBloodDonors.map(donor => (
                        <div key={donor.id} className="blood-donor-card">
                          <div className="blood-card-top">
                            <div className="blood-type-badge donor-type">{donor.bloodType}</div>
                            <div className="blood-card-top-info">
                              <span className="blood-card-donor-name">{donor.name}</span>
                              <span style={{ fontSize: '0.78rem', color: donor.available ? '#86efac' : '#fca5a5', fontWeight: '600' }}>
                                {donor.available ? '✓ Disponible para donar' : 'No disponible en este momento'}
                              </span>
                            </div>
                          </div>

                          <div className="blood-card-meta">
                            <div className="blood-meta-item">
                              <MapPin size={13} />
                              <span>{donor.locationName}</span>
                            </div>
                            {donor.lastDonation && (
                              <div className="blood-meta-item">
                                <Syringe size={13} />
                                <span>Última donación: {donor.lastDonation}</span>
                              </div>
                            )}
                            <div className="blood-meta-item">
                              <Clock size={13} />
                              <span>Registrado {getRelativeTime(donor.createdAt)}</span>
                            </div>
                          </div>

                          <div className="blood-card-actions">
                            <a href={`tel:${donor.phone}`} className="btn-blood-call">
                              <Phone size={13} />
                              Llamar
                            </a>
                            <a href={`https://wa.me/${donor.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn-blood-wa">
                              WhatsApp
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* PESTAÑA: Formulario para Reportar Persona */}
          {activeTab === 'add' && (
            <div className="form-layout-container">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={24} style={{ color: 'hsl(var(--color-primary))' }} />
                Registrar Nuevo Caso
              </h2>

              {formError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ff6b6b', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmitReport}>
                {/* Upload de Foto */}
                <div className="form-group">
                  <label>Foto de la Persona (Opcional)</label>
                  {!photo ? (
                    <div className="image-uploader" onClick={() => fileInputRef.current.click()}>
                      <Camera size={32} style={{ color: 'hsl(var(--text-muted))' }} />
                      <span>Haga clic para subir una foto</span>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                        Formatos JPG, PNG. Se optimizará automáticamente.
                      </span>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </div>
                  ) : (
                    <div className="image-preview-container">
                      <img src={photo} alt="Vista previa" className="image-preview" />
                      <button 
                        type="button" 
                        className="remove-image-btn"
                        onClick={handleRemovePhoto}
                        title="Quitar foto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="name">Nombre Completo de la Persona *</label>
                  <input 
                    type="text" 
                    id="name"
                    className="form-control"
                    placeholder="Ej. Carlos Mendoza"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cedula">Cédula de Identidad (Opcional)</label>
                  <input 
                    type="text" 
                    id="cedula"
                    className="form-control"
                    placeholder="Ej. V-12345678"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="phone">Teléfono de Contacto *</label>
                    <input 
                      type="tel" 
                      id="phone"
                      className="form-control"
                      placeholder="Ej. +58 412-555-0192"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="status">Estado Inicial</label>
                    <select 
                      id="status"
                      className="form-control"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="missing">Desaparecido</option>
                      <option value="hospitalized">Hospitalizado (En Hospital/Clínica)</option>
                      <option value="located">Ubicado / Con Necesidades</option>
                      <option value="safe">A Salvo / Seguro</option>
                    </select>
                  </div>
                </div>

                {/* Campos condicionales si el estado es Hospitalizado */}
                {status === 'hospitalized' && (
                  <div style={{ padding: '1rem', backgroundColor: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.9rem', color: '#c084fc', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-display)' }}>
                      <Heart size={14} />
                      Información del Centro de Salud
                    </h3>
                    <div className="form-group">
                      <label htmlFor="hospitalName">Nombre del Hospital / Centro Médico *</label>
                      <input 
                        type="text" 
                        id="hospitalName"
                        className="form-control"
                        placeholder="Ej. Hospital Pérez Carreño o Clínica Ávila"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        required={status === 'hospitalized'}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="hospitalDetails">Detalles de Sala, Cama o Condición (Opcional)</label>
                      <input 
                        type="text" 
                        id="hospitalDetails"
                        className="form-control"
                        placeholder="Ej. Sala de Urgencias, Cama 4. Condición estable."
                        value={hospitalDetails}
                        onChange={(e) => setHospitalDetails(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Campo de Dirección con botón de Geolocalización Nominatim */}
                <div className="form-group">
                  <label htmlFor="locationName">Lugar / Estado / Ciudad de Desaparición/Avistamiento *</label>
                  <div className="location-input-group">
                    <input 
                      type="text" 
                      id="locationName"
                      className="form-control"
                      placeholder="Ej. Altamira, Caracas"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      required
                    />
                    <button 
                      type="button" 
                      className="btn btn-primary btn-locate"
                      onClick={handleSearchLocation}
                      disabled={isSearchingLocation}
                    >
                      {isSearchingLocation ? 'Buscando...' : '🔍 Ubicar'}
                    </button>
                  </div>
                  <span className="form-helper">
                    Escribe una dirección (ciudad, estado, calle) y presiona "Ubicar" para posicionar el mapa automáticamente. También puedes hacer clic en el mapa.
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="description">Descripción y Señas Particulares *</label>
                  <textarea 
                    id="description"
                    className="form-control"
                    rows="3"
                    placeholder="Detalles sobre vestimenta, estatura, último avistamiento conocido, condiciones médicas, etc."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  ></textarea>
                </div>

                {/* Mapa Selector de Coordenadas */}
                <div className="form-group">
                  <label>Ubicación en el Mapa *</label>
                  <div className="mini-map-container">
                    <MapContainer 
                      center={[10.4806, -66.9036]} 
                      zoom={6} 
                      style={{ height: '100%', width: '100%' }}
                      scrollWheelZoom={true}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <FormLocationSelector position={formPosition} setPosition={setFormPosition} />
                      
                      {/* Controlador para centrar el mini-mapa cuando se busca por geocodificación */}
                      {formPosition && <MapController center={[formPosition.lat, formPosition.lng]} zoom={14} />}
                    </MapContainer>
                  </div>
                  <span className="form-helper">
                    {formPosition 
                      ? `Coordenadas seleccionadas: ${formPosition.lat.toFixed(5)}, ${formPosition.lng.toFixed(5)}`
                      : 'Haga clic en el mapa de arriba para marcar la ubicación aproximada de la persona.'
                    }
                  </span>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ marginTop: '1rem' }}
                >
                  {isSubmitting ? 'Enviando reporte...' : 'Publicar Reporte'}
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>
          )}
        </section>
      </main>

      {/* MODAL: Publicar Anuncio en el Tablón */}
      {isHelpModalOpen && (
        <div className="help-modal-overlay">
          <div className="help-modal">
            <div className="help-modal-header">
              <h2 className="help-modal-title">Publicar en el Tablón</h2>
              <button 
                type="button" 
                className="btn-close-modal"
                onClick={() => setIsHelpModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="help-modal-body">
              <form onSubmit={handleSubmitHelpItem}>
                
                {/* Tipo de Anuncio */}
                <div className="form-group">
                  <label>Tipo de Anuncio *</label>
                  <div className="radio-group">
                    <label className={`radio-option need ${helpType === 'need' ? 'active' : ''}`}>
                      <input 
                        type="radio" 
                        name="helpType" 
                        value="need"
                        checked={helpType === 'need'}
                        onChange={() => setHelpType('need')}
                      />
                      <span>Necesito Apoyo</span>
                    </label>
                    <label className={`radio-option offer ${helpType === 'offer' ? 'active' : ''}`}>
                      <input 
                        type="radio" 
                        name="helpType" 
                        value="offer"
                        checked={helpType === 'offer'}
                        onChange={() => setHelpType('offer')}
                      />
                      <span>Ofrezco Ayuda</span>
                    </label>
                  </div>
                </div>

                {/* Categoría */}
                <div className="form-group">
                  <label htmlFor="helpCategory">Categoría *</label>
                  <select 
                    id="helpCategory" 
                    className="form-control"
                    value={helpCategory}
                    onChange={(e) => setHelpCategory(e.target.value)}
                  >
                    <option value="medicines">Medicinas</option>
                    <option value="food_water">Alimentos / Agua</option>
                    <option value="transport">Transporte</option>
                    <option value="tools_rescue">Rescate / Herramientas</option>
                    <option value="shelter">Refugio</option>
                    <option value="other">Otros / General</option>
                  </select>
                </div>

                {/* Nivel de Urgencia */}
                <div className="form-group">
                  <label htmlFor="helpUrgency">Nivel de Urgencia *</label>
                  <select 
                    id="helpUrgency" 
                    className="form-control"
                    value={helpUrgency}
                    onChange={(e) => setHelpUrgency(e.target.value)}
                  >
                    <option value="low">Baja (Organización, acopio general)</option>
                    <option value="medium">Media (Se necesita pronto)</option>
                    <option value="critical">Crítica (Emergencia inmediata, riesgo vital)</option>
                  </select>
                </div>

                {/* Título */}
                <div className="form-group">
                  <label htmlFor="helpTitle">Título del Anuncio *</label>
                  <input 
                    type="text"
                    id="helpTitle"
                    className="form-control"
                    placeholder="Ej. Se necesita agua mineral o Ofrezco transporte médico"
                    value={helpTitle}
                    onChange={(e) => setHelpTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Descripción */}
                <div className="form-group">
                  <label htmlFor="helpDescription">Detalles del Anuncio *</label>
                  <textarea 
                    id="helpDescription"
                    className="form-control"
                    rows="3"
                    placeholder="Describa a detalle qué necesita u ofrece, cantidades, horarios, etc."
                    value={helpDescription}
                    onChange={(e) => setHelpDescription(e.target.value)}
                    required
                  ></textarea>
                </div>

                {/* Lugar de Contacto */}
                <div className="form-group">
                  <label htmlFor="helpLocationName">Ubicación / Zona de Contacto *</label>
                  <input 
                    type="text"
                    id="helpLocationName"
                    className="form-control"
                    placeholder="Ej. Plaza Altamira, Caracas o Centro de Acopio Maiquetía"
                    value={helpLocationName}
                    onChange={(e) => setHelpLocationName(e.target.value)}
                    required
                  />
                </div>

                {/* Nombre de Contacto */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="helpContactName">Persona de Contacto *</label>
                    <input 
                      type="text"
                      id="helpContactName"
                      className="form-control"
                      placeholder="Ej. Dr. José Rivas"
                      value={helpContactName}
                      onChange={(e) => setHelpContactName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="helpContactPhone">Teléfono de Contacto *</label>
                    <input 
                      type="text"
                      id="helpContactPhone"
                      className="form-control"
                      placeholder="Ej. +58 412-555-1234"
                      value={helpContactPhone}
                      onChange={(e) => setHelpContactPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ marginTop: '1rem' }}
                >
                  {isSubmitting ? 'Publicando...' : 'Publicar Anuncio'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Registro de Donante de Sangre */}
      {isBloodDonorModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBloodDonorModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem' }}>🩸</span>
                <div>
                  <h3 className="modal-title">Registrarme como Donante</h3>
                  <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', margin: 0 }}>Tu donación puede salvar una vida hoy</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setIsBloodDonorModalOpen(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmitDonor} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Tipo de Sangre *</label>
                <select className="form-select" value={donorBloodType} onChange={e => setDonorBloodType(e.target.value)}>
                  {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input className="form-input" placeholder="Tu nombre" value={donorName} onChange={e => setDonorName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono de Contacto *</label>
                <input className="form-input" placeholder="+58 412-XXX-XXXX" value={donorPhone} onChange={e => setDonorPhone(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Zona donde te encuentras *</label>
                <input className="form-input" placeholder="Ej: Catia, Caracas" value={donorLocation} onChange={e => setDonorLocation(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de última donación (si recuerdas)</label>
                <input className="form-input" type="date" value={donorLastDonation} onChange={e => setDonorLastDonation(e.target.value)} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', background: 'rgba(59,130,246,0.08)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid hsl(var(--color-primary))' }}>
                ⚠ Recuerda que debes esperar mínimo 56 días entre donaciones y estar en buen estado de salud.
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ marginTop: '0.5rem', background: '#dc2626' }}>
                {isSubmitting ? 'Registrando...' : '🩸 Registrarme como Donante'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Solicitud de Sangre (Hospitales) */}
      {isBloodRequestModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBloodRequestModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem' }}>🏥</span>
                <div>
                  <h3 className="modal-title">Publicar Solicitud Urgente de Sangre</h3>
                  <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', margin: 0 }}>Para hospitales y centros de salud</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setIsBloodRequestModalOpen(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmitBloodRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Tipo de Sangre Necesario *</label>
                  <select className="form-select" value={reqBloodType} onChange={e => setReqBloodType(e.target.value)}>
                    {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nivel de Urgencia *</label>
                  <select className="form-select" value={reqUrgency} onChange={e => setReqUrgency(e.target.value)}>
                    <option value="critical">⚠ Crítico (Cirugía activa)</option>
                    <option value="high">Alta (Próximas horas)</option>
                    <option value="medium">Media (Próximas 24h)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Unidades Necesarias *</label>
                <input className="form-input" type="number" min="1" max="20" value={reqUnits} onChange={e => setReqUnits(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Hospital / Centro de Salud *</label>
                <input className="form-input" placeholder="Nombre completo del hospital" value={reqHospital} onChange={e => setReqHospital(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Dirección / Zona *</label>
                <input className="form-input" placeholder="Ej: El Paraíso, Caracas" value={reqLocation} onChange={e => setReqLocation(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción del Caso *</label>
                <textarea className="form-input" rows={3} placeholder="Describe brevemente la situación del paciente o la urgencia clínica..." value={reqCondition} onChange={e => setReqCondition(e.target.value)} required style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Nombre del Responsable *</label>
                  <input className="form-input" placeholder="Dr. / Enfermero..." value={reqContactName} onChange={e => setReqContactName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono de Contacto *</label>
                  <input className="form-input" placeholder="+58 212-XXX-XXXX" value={reqContactPhone} onChange={e => setReqContactPhone(e.target.value)} required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ marginTop: '0.5rem', background: '#dc2626' }}>
                {isSubmitting ? 'Publicando...' : '🏥 Publicar Solicitud Urgente'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
