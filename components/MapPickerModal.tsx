import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { XCircleIcon } from './icons';

// Fix for React/Vite breaking default Leaflet image paths
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Default center: Orem, Utah
const defaultCenter: [number, number] = [40.2969, -111.6946];

interface MapPickerModalProps {
  onClose: () => void;
  onSave: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

// Sub-component to listen for map clicks
const MapInteraction: React.FC<{ setMarker: (pos: {lat: number, lng: number}) => void }> = ({ setMarker }) => {
  useMapEvents({
    click(e) {
      setMarker({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const MapPickerModal: React.FC<MapPickerModalProps> = ({ onClose, onSave, initialLat, initialLng }) => {
  const hasValidInitialCoords = initialLat && initialLng && !isNaN(initialLat) && !isNaN(initialLng);
  
  const [marker, setMarker] = useState<{lat: number, lng: number} | null>(
      hasValidInitialCoords ? { lat: initialLat, lng: initialLng } : null
  );

  const startingCenter: [number, number] = hasValidInitialCoords 
    ? [initialLat, initialLng] 
    : defaultCenter;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative">
        
        {/* Header */}
        <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center z-20 relative">
            <div>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Select Field Location</h2>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Click the map to drop a pin</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                <XCircleIcon className="h-8 w-8" />
            </button>
        </div>

        {/* Map Container */}
        <div className="p-4 bg-gray-100 relative z-10">
            <div className="rounded-xl overflow-hidden border-4 border-white shadow-md relative">
                <MapContainer 
                    center={startingCenter} 
                    zoom={marker ? 16 : 11} 
                    style={{ height: '400px', width: '100%', zIndex: 1 }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapInteraction setMarker={setMarker} />
                    {marker && (
                        <Marker position={[marker.lat, marker.lng]} icon={markerIcon} />
                    )}
                </MapContainer>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 z-20 relative">
            <div className="text-sm font-black text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-200">
                {marker ? `LAT: ${marker.lat.toFixed(6)} | LNG: ${marker.lng.toFixed(6)}` : 'No coordinates selected'}
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
                <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-black uppercase text-sm hover:bg-gray-300 transition-all">
                    Cancel
                </button>
                <button
                    disabled={!marker}
                    onClick={() => marker && onSave(marker.lat, marker.lng)}
                    className="flex-1 sm:flex-none px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-lg shadow-indigo-200"
                >
                    Add Coordinates
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default MapPickerModal;