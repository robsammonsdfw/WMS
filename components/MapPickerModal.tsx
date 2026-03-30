import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { XCircleIcon } from './icons';

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '0.75rem'
};

// Default center: Orem, Utah
const defaultCenter = { lat: 40.2969, lng: -111.6946 };

interface MapPickerModalProps {
  onClose: () => void;
  onSave: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

const MapPickerModal: React.FC<MapPickerModalProps> = ({ onClose, onSave, initialLat, initialLng }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    // IMPORTANT: You must replace this with your actual Google Cloud API Key
    googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY_HERE" 
  });

  const [marker, setMarker] = useState<{lat: number, lng: number} | null>(
      initialLat && initialLng && !isNaN(initialLat) && !isNaN(initialLng) 
        ? { lat: initialLat, lng: initialLng } 
        : null
  );

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setMarker({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Select Field Location</h2>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Click the map to drop a pin</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                <XCircleIcon className="h-8 w-8" />
            </button>
        </div>

        {/* Map Container */}
        <div className="p-4 bg-gray-100">
            {!isLoaded ? (
                <div className="h-[400px] flex items-center justify-center bg-gray-200 rounded-xl border-2 border-dashed border-gray-300">
                    <p className="text-gray-500 font-black uppercase tracking-widest animate-pulse">Loading Google Maps...</p>
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden border-4 border-white shadow-md">
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={marker || defaultCenter}
                      zoom={marker ? 16 : 11}
                      onClick={onMapClick}
                      options={{ streetViewControl: false, mapTypeControl: true, fullscreenControl: false }}
                    >
                      {marker && <Marker position={marker} animation={google.maps.Animation.DROP} />}
                    </GoogleMap>
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
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
                    className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-sm hover:bg-blue-700 disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-lg shadow-blue-200"
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