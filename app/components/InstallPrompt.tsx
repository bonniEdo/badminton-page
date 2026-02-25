'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download } from 'lucide-react';
import { Fab } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    setIsMobileDevice(mobileUA);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  if (!visible || !isMobileDevice) return null;

  return (
    <Fab
      onClick={handleInstall}
      aria-label="加到主畫面"
      className="fixed bottom-24 right-6 z-50"
    >
      <Download size={24} strokeWidth={2} />
    </Fab>
  );
}
