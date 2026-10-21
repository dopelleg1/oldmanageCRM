import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { matchRecord } from '@/hooks/useUnifiedSearch';

export const useClientSearch = (data, tableName) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { user, userRole } = useAuth();
  const { agents } = useData();

  const agentMap = useMemo(() => {
    if (!agents) return {};
    return agents.reduce((acc, agent) => ({ ...acc, [agent.id]: agent.name }), {});
  }, [agents]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    let roleFiltered = data;
    
    if (!searchTerm || !searchTerm.trim()) return roleFiltered;

    return roleFiltered.filter(item => matchRecord(item, tableName, searchTerm, agentMap));
  }, [data, searchTerm, tableName, agentMap]);

  return {
    searchTerm,
    setSearchTerm,
    filteredData,
    totalCount: data?.length || 0,
    filteredCount: filteredData.length
  };
};