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
  Trash2
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
  const [photo, setPhoto] = useState(null); // String Base64 comprimida
  const [formPosition, setFormPosition] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

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
                          <h3 className="card-name">{report.name}</h3>
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
                            <span className="popup-name">{report.name}</span>
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
    </div>
  );
}
