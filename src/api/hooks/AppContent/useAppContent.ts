// src/api/hooks/AppContent/useAppContent.ts

import { useEffect, useState, useCallback } from 'react';
import { appContentService } from '../../services/appContentService';

/**
 * Fetches an AppContent row (id + HTML/JSON data) by id.
 * Pass a SchemeId for scheme Terms & Conditions, or "FAQ" for the FAQ page.
 */
export const useAppContent = (id: string | number | undefined | null) => {
  const [html, setHtml]     = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    if (id === undefined || id === null || id === '') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await appContentService.getById(id);
      // console.log('[useAppContent] html data:', result?.data);
      setHtml(result?.data ?? '');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  return { html, loading, error, refetch: fetchContent };
};
