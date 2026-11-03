import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { axiosInstance } from '../api/axiosInstance';
import { APP_CONFIG } from '../api/endpoints';
import { withTimeout } from './withTimeout';

interface AppConfig {
  PLAYSTORE_VERSION: string;
  STORE_URL: string;
  APPSTORE_VERSION: string;
  APPSTORE_URL: string;
  IS_MAINTENANCE: boolean;
  MAINTENANCE_MSG: string;
}

function isOutdated(current: string, required: string): boolean {
  const c = current.split('.').map(Number);
  const r = required.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((c[i] ?? 0) < (r[i] ?? 0)) return true;
    if ((c[i] ?? 0) > (r[i] ?? 0)) return false;
  }
  return false;
}

export function useAppVersion() {
  const [isMaintenance, setIsMaintenance]   = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion]   = useState('');
  const [storeUrl, setStoreUrl]             = useState('');
  const [checked, setChecked]               = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Short cap — the app must never sit on the splash spinner waiting for this
        const res  = await withTimeout(
          axiosInstance.get<AppConfig[]>(APP_CONFIG.ALL, { timeout: 8000, skipSessionExpiry: true }),
          9000,
        );
        const cfg  = res.data?.[0];
        if (!cfg) { setChecked(true); return; }

        if (cfg.IS_MAINTENANCE) {
          setIsMaintenance(true);
          setMaintenanceMsg(cfg.MAINTENANCE_MSG);
          setChecked(true);
          return;
        }

        const required = Platform.OS === 'ios' ? cfg.APPSTORE_VERSION : cfg.PLAYSTORE_VERSION;
        const url      = Platform.OS === 'ios' ? cfg.APPSTORE_URL     : cfg.STORE_URL;
        const current  = Constants.expoConfig?.version ?? '0.0.0';

        if (isOutdated(current, required)) {
          setUpdateAvailable(true);
          setLatestVersion(required);
          setStoreUrl(url);
        }
      } catch { /* fail open */ }
      setChecked(true);
    })();
  }, []);

  return { isMaintenance, maintenanceMsg, updateAvailable, latestVersion, storeUrl, checked };
}
