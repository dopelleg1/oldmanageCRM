import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useDebounce } from '@/hooks/useDraftAutoSave';
import { useData } from '@/contexts/DataContext';

export const useDuplicatePhoneCheck = (tableName, currentPhoneNumber, currentRecordId = null) => {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateRecord, setDuplicateRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cacheBuster, setCacheBuster] = useState(0);

  const dataContext = useData();

  // Debounce the phone number input by 400ms
  const debouncedPhone = useDebounce(currentPhoneNumber, 400);

  // Listen for cache invalidation events (e.g., after deletion)
  useEffect(() => {
    const handleInvalidation = () => {
      setCacheBuster(prev => prev + 1);
    };
    
    window.addEventListener('duplicate-cache-invalidated', handleInvalidation);
    return () => window.removeEventListener('duplicate-cache-invalidated', handleInvalidation);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkDuplicate = async () => {
      if (!debouncedPhone || debouncedPhone.length < 3) {
        if (isMounted) {
          setIsDuplicate(false);
          setDuplicateRecord(null);
          setError(null);
        }
        return;
      }

      if (isMounted) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const normalizedPhone = debouncedPhone.replace(/[^0-9+]/g, '');
        if (!normalizedPhone) {
          if (isMounted) setIsLoading(false);
          return;
        }

        // 1. In-memory check first (Fastest, zero Supabase network requests)
        let localDataset = [];
        if (dataContext) {
          if (tableName === 'telemarketing_contacts') localDataset = dataContext.telemarketing || [];
          else if (tableName === 'potential_activities') localDataset = dataContext.potentialActivities || [];
          else if (tableName === 'commercial_activities') localDataset = dataContext.activities || [];
          else if (tableName === 'properties') localDataset = dataContext.properties || [];
          else if (tableName === 'potential_tobacconists') localDataset = dataContext.potentialTobacconists || [];
        }

        const phoneField = (tableName === 'commercial_activities' || tableName === 'properties')
          ? 'telefono_proprietario'
          : 'telefono';

        if (localDataset.length > 0) {
          const match = localDataset.find(item => {
            if (currentRecordId && item.id === currentRecordId) return false;
            const p1 = (item[phoneField] || '').replace(/[^0-9+]/g, '');
            const p2 = (item.phone_2 || '').replace(/[^0-9+]/g, '');
            return (p1 && p1 === normalizedPhone) || (p2 && p2 === normalizedPhone);
          });

          if (isMounted) {
            setIsDuplicate(!!match);
            setDuplicateRecord(match || null);
            setIsLoading(false);
          }
          return;
        }

        // 2. Fallback to Supabase query only if local data is unavailable
        let selectFields = 'id, nome, cognome, telefono, email, indirizzo, is_master_record';
        if (tableName === 'commercial_activities' || tableName === 'properties') {
          selectFields = 'id, nome_proprietario, cognome_proprietario, telefono_proprietario, email_proprietario, indirizzo, is_master_record';
        }

        let query = supabase
          .from(tableName)
          .select(selectFields)
          .eq(phoneField, normalizedPhone);

        if (currentRecordId) {
          query = query.neq('id', currentRecordId);
        }
        
        const { data, error: queryError } = await query.maybeSingle();

        if (queryError && queryError.code !== 'PGRST116') {
          throw queryError;
        }

        if (isMounted) {
          setIsDuplicate(!!(data && data.id));
          setDuplicateRecord(data?.id ? data : null);
        }

      } catch (err) {
        console.error('Error checking duplicate phone:', err);
        if (isMounted) {
          setError(err.message || 'Errore durante la verifica duplicati');
          setIsDuplicate(false);
          setDuplicateRecord(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkDuplicate();

    return () => {
      isMounted = false;
    };
  }, [debouncedPhone, tableName, currentRecordId, cacheBuster, dataContext]);

  return { isDuplicate, duplicateRecord, isLoading, error };
};