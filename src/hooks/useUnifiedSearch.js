import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/SupabaseAuthContext.jsx';
import { useData } from '../contexts/DataContext.jsx';
import {
  normalizePhone,
  matchRecord,
  getRecordIdentifier,
  getRecordTitle,
  getRecordSubtitle
} from '../utils/recordMatcher.js';

export {
  normalizePhone,
  matchRecord,
  getRecordIdentifier,
  getRecordTitle,
  getRecordSubtitle
};

export const useUnifiedSearch = (baseData, tableName, options = {}) => {
  const { user, userRole } = useAuth();
  const { agents } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAllRecords, setShowAllRecords] = useState(false);

  const { activeTab, tabField = 'type' } = options;

  // Map agents for quick name resolution
  const agentMap = useMemo(() => {
    if (!agents) return {};
    return agents.reduce((acc, agent) => ({ ...acc, [agent.id]: agent.name }), {});
  }, [agents]);

  // Main filtered output (Local table search)
  const filteredData = useMemo(() => {
    const isAgent = ['agente', 'telemarketing'].includes(userRole);
    let localFiltered = baseData || [];

    // If searching actively: search across all records in baseData (ignoring tab and agent filters so matches are found)
    if (searchTerm && searchTerm.trim() !== '') {
      return localFiltered.filter(item => matchRecord(item, tableName, searchTerm, agentMap));
    }

    // Normal browsing mode: apply tab filter and agent filter
    if (activeTab && activeTab !== 'all') {
      localFiltered = localFiltered.filter(item => (item[tabField] || '').toLowerCase() === activeTab.toLowerCase());
    }

    if (isAgent && !showAllRecords) {
      localFiltered = localFiltered.filter(item => item.agente_id === user?.id);
    }

    return localFiltered;
  }, [
    baseData,
    tableName,
    searchTerm,
    showAllRecords,
    activeTab,
    tabField,
    userRole,
    user,
    agentMap
  ]);

  return {
    searchTerm,
    setSearchTerm,
    showAllRecords,
    setShowAllRecords,
    searchInAllTables: false,
    setSearchInAllTables: () => {},
    filteredData,
    isGlobalSearchActive: false,
    totalCount: baseData?.length || 0,
    filteredCount: filteredData.length
  };
};
