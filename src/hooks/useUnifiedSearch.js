import { useState, useMemo, useCallback } from 'react';
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
  const {
    activities,
    properties,
    potentialTobacconists,
    potentialActivities,
    telemarketing,
    appointments,
    agents
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [searchInAllTables, setSearchInAllTables] = useState(false);

  const { activeTab, tabField = 'type' } = options;

  // Map agents for quick name resolution
  const agentMap = useMemo(() => {
    if (!agents) return {};
    return agents.reduce((acc, agent) => ({ ...acc, [agent.id]: agent.name }), {});
  }, [agents]);

  // Helper to search a single dataset and return standardized search results
  const searchDataset = useCallback((dataset, targetTableName, displayName) => {
    if (!dataset) return [];

    let visibleData = dataset;
    const isAgent = ['agente', 'telemarketing'].includes(userRole);
    // When actively searching, allow matching records across agents so nothing is hidden
    if (isAgent && !showAllRecords && !searchInAllTables && !searchTerm.trim()) {
      visibleData = dataset.filter(item => item.agente_id === user?.id);
    }

    if (!searchTerm || !searchTerm.trim()) {
      return visibleData.map(item => ({
        id: item.id,
        type: targetTableName,
        typeName: displayName,
        identifier: getRecordIdentifier(item, targetTableName),
        title: getRecordTitle(item, targetTableName),
        subtitle: getRecordSubtitle(item, targetTableName),
        agentName: agentMap[item.agente_id] || 'Non assegnato',
        createdAt: item.created_at || new Date().toISOString(),
        originalRecord: { ...item, recordType: displayName }
      }));
    }

    return visibleData
      .filter(item => matchRecord(item, targetTableName, searchTerm, agentMap))
      .map(item => ({
        id: item.id,
        type: targetTableName,
        typeName: displayName,
        identifier: getRecordIdentifier(item, targetTableName),
        title: getRecordTitle(item, targetTableName),
        subtitle: getRecordSubtitle(item, targetTableName),
        agentName: agentMap[item.agente_id] || 'Non assegnato',
        createdAt: item.created_at || new Date().toISOString(),
        originalRecord: { ...item, recordType: displayName }
      }));
  }, [user, userRole, showAllRecords, searchInAllTables, searchTerm, agentMap]);

  // Main filtered output
  const filteredData = useMemo(() => {
    const isAgent = ['agente', 'telemarketing'].includes(userRole);

    // 1. If global search is active and term is not empty
    if (searchInAllTables && searchTerm.trim() !== '') {
      const results = [
        ...searchDataset(activities, 'commercial_activities', 'Attività Commerciale'),
        ...searchDataset(properties, 'properties', 'Immobile'),
        ...searchDataset(potentialTobacconists, 'potential_tobacconists', 'Potenziale Tabaccheria'),
        ...searchDataset(potentialActivities, 'potential_activities', 'Potenziale Acquirente/Venditore'),
        ...searchDataset(telemarketing, 'telemarketing_contacts', 'Telemarketing'),
        ...searchDataset(appointments, 'appointments', 'Appuntamento')
      ];

      // Sort by creation date
      return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 2. Local Search Mode
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
    searchInAllTables,
    activeTab,
    tabField,
    userRole,
    user,
    searchDataset,
    activities,
    properties,
    potentialTobacconists,
    potentialActivities,
    telemarketing,
    appointments,
    agentMap
  ]);

  return {
    searchTerm,
    setSearchTerm,
    showAllRecords,
    setShowAllRecords,
    searchInAllTables,
    setSearchInAllTables,
    filteredData,
    isGlobalSearchActive: searchInAllTables && searchTerm.trim() !== '',
    totalCount: baseData?.length || 0,
    filteredCount: filteredData.length
  };
};
