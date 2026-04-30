import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (errorMessage: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let html5QrCode: Html5Qrcode;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode("reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
           { facingMode: "environment" },
           {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
           },
           (decodedText) => {
              if (html5QrCode.isScanning) {
                html5QrCode.pause();
              }
              onScan(decodedText);
           },
           (error) => {
              // Ignore standard frame scan errors 
           }
        );
        setIsInitializing(false);
      } catch (err) {
        console.error("Scanner startup error:", err);
        setIsInitializing(false);
        if (onError) onError(String(err));
      }
    };

    startScanner();

    return () => {
      // Need a timeout to ensure stop isn't called simultaneously with start
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
           scannerRef.current.stop()
             .then(() => {
                scannerRef.current?.clear();
             })
             .catch(console.error);
        } else {
           scannerRef.current.clear();
        }
      }
    };
  }, [onScan, onError]);

  return (
    <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden flex items-center justify-center">
      {isInitializing && (
        <div className="absolute inset-0 flex items-center justify-center text-cyan-400 font-bold z-10 bg-black/50">
          Iniciando câmera...
        </div>
      )}
      <div id="reader" className="w-full h-full" />
    </div>
  );
}

