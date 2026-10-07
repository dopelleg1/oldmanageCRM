import { useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';

export const useConfigurableFields = () => {
  const dataContext = useData();
  const configurations = dataContext?.configurations || [];
  const addRecord = dataContext?.addRecord;
  const loading = dataContext?.loading || false;

  const getFieldOptions = useCallback((fieldName) => {
    return configurations
      .filter(item => item.type === fieldName)
      .map(item => item.value)
      .sort((a, b) => a.localeCompare(b));
  }, [configurations]);

  const fieldExists = useCallback((fieldName, value) => {
    if (!value) return true; // Empty value is considered "valid" (not a missing option)
    const options = getFieldOptions(fieldName);
    return options.some(opt => opt.toLowerCase() === String(value).trim().toLowerCase());
  }, [getFieldOptions]);

  const addNewOption = useCallback(async (fieldName, value) => {
    if (!value) return null;
    try {
      const trimmedValue = value.trim();
      // Check in local configurations first to avoid extra DB query
      const existing = configurations.find(
        opt => opt.type === fieldName && opt.value.toLowerCase() === trimmedValue.toLowerCase()
      );
      if (existing) return existing;

      const { data, error } = await supabase
        .from('configurations')
        .insert([{ type: fieldName, value: trimmedValue }])
        .select()
        .single();

      if (error) throw error;
      if (data && addRecord) {
        addRecord('configurations', data);
      }
      return data;
    } catch (err) {
      console.error(`Error adding new option for ${fieldName}:`, err);
      throw err;
    }
  }, [configurations, addRecord]);

  return {
    configurations,
    getFieldOptions,
    fieldExists,
    addNewOption,
    loading,
    error: null
  };
};