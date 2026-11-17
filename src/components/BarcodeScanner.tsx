import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

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
/** Back camera at a resolution high enough to read the thin bars of a barcode. */
const CAMERA: MediaTrackConstraints = { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } };

export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const done = useRef(false);
  // The parent passes a new function on every render: keep the latest in a ref so the camera
  // starts once instead of restarting (and never reading a code) at each render.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopZxing: (() => void) | null = null;
    let cancelled = false;

    const found = (code: string) => {
      if (done.current) return;
      done.current = true;
      navigator.vibrate?.(80);
      onCodeRef.current(code);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocamera');
        if (window.BarcodeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: CAMERA, audio: false });
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
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
          if (cancelled || !video.current) return;
          // Only product barcodes: faster and more reliable than trying every format.
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
          const controls = await reader.decodeFromConstraints({ video: CAMERA, audio: false }, video.current, (result) => {
            if (result) found(result.getText());
          });
          stopZxing = () => controls.stop();
        }
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(
          name === 'NotAllowedError'
            ? t('Camera access was refused. Allow the camera for this app in your phone settings, or type the barcode below.')
            : t('The camera could not start on this device. Type the barcode below instead.'),
        );
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
      <p className="muted small">{t('Point the camera at the barcode. It scans by itself.')}</p>
      <button className="btn btn-small" onClick={onClose}>
        {t('Close camera')}
      </button>
    </div>
  );
}
