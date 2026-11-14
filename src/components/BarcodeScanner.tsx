import { useEffect, useRef, useState } from 'react';

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

/**
 * Live camera barcode reader. Uses the browser's BarcodeDetector where it exists (Chrome on
 * Android) and otherwise loads the ZXing reader (iPhone), only when the scanner opens.
 */
export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopZxing: (() => void) | null = null;
    let cancelled = false;

    const found = (code: string) => {
      if (done.current) return;
      done.current = true;
      navigator.vibrate?.(80);
      onCode(code);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocamera');
        if (window.BarcodeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          if (cancelled || !video.current) return;
          video.current.srcObject = stream;
          await video.current.play();
          const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          timer = setInterval(async () => {
            if (!video.current || video.current.readyState < 2) return;
            try {
              const codes = await detector.detect(video.current);
              if (codes[0]) found(codes[0].rawValue);
            } catch {
              /* keep trying */
            }
          }, 250);
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (cancelled || !video.current) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment' }, audio: false },
            video.current,
            (result) => {
              if (result) found(result.getText());
            },
          );
          stopZxing = () => controls.stop();
        }
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was refused. Allow the camera for this app in your phone settings, or type the barcode below.'
            : 'The camera could not start on this device. Type the barcode below instead.',
        );
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="scanner">
      {error ? (
        <p className="field-error">{error}</p>
      ) : (
        <div className="scanner-view">
          <video ref={video} playsInline muted />
          <span className="scanner-frame" aria-hidden="true" />
        </div>
      )}
      <p className="muted small">Point the camera at the barcode. It scans by itself.</p>
      <button className="btn btn-small" onClick={onClose}>
        Close camera
      </button>
    </div>
  );
}
