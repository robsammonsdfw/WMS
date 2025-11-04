import React, { useEffect, useRef, useState } from 'react';
import { XCircleIcon } from './icons';

interface ScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number | null = null;
    let barcodeDetector: any | null = null;

    const startScan = async () => {
      if (!('BarcodeDetector' in window)) {
        setError('QR code scanning is not supported by this browser.');
        return;
      }
      
      barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        console.error("Camera access error:", err);
        if (err instanceof DOMException) {
            if (err.name === 'NotAllowedError') {
                setError('Camera permission denied. Please allow camera access in your browser settings.');
            } else if (err.name === 'NotFoundError') {
                setError('No camera found on this device.');
            } else {
                 setError('Could not access camera. Please ensure it is not in use by another application.');
            }
        } else {
            setError('An unexpected error occurred while accessing the camera.');
        }
        return;
      }

      const detect = async () => {
        if (videoRef.current && barcodeDetector && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              onScan(barcodes[0].rawValue);
              return; // Stop scanning once a code is found
            }
          } catch (e) {
            console.error('Barcode detection failed:', e);
          }
        }
        animationFrameId = requestAnimationFrame(detect);
      };

      detect();
    };

    startScan();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScan]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-title"
    >
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-lg relative text-center">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          aria-label="Close scanner"
        >
          <XCircleIcon className="h-8 w-8" />
        </button>
        <h2 id="scanner-title" className="text-xl font-bold text-gray-800 mb-4">Scan QR Code</h2>
        
        <div className="w-full aspect-square bg-gray-900 rounded-md overflow-hidden relative flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-0 border-4 border-dashed border-white/50 rounded-md"></div>
             {error && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
                    <p className="text-white text-center">{error}</p>
                </div>
            )}
        </div>
        
        <p className="text-gray-500 mt-4">Point your camera at a QR code to start or end a water delivery.</p>
      </div>
    </div>
  );
};

export default Scanner;
