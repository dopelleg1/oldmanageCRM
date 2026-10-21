import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { getSearchableFields } from '@/utils/searchConfig';

export const useUnifiedSearch = (baseData, tableName) => {
  const { user, userRole } = useAuth();
  const {
    activities,
    properties,
    potentialTobacconists,
    potentialActivities,
    telemarketing,
    agents
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [searchInAllTables, setSearchInAllTables] = useState(false);

  // Map agents for quick name resolution
  const agentMap = useMemo(() => {
    if (!agents) return {};
    return agents.reduce((acc, agent) => ({ ...acc, [agent.id]: agent.name }), {});
  }, [agents]);

  // Helper to search a single dataset and return standardized search results
  const searchDataset = useCallback((dataset, targetTableName, displayName, fields) => {
    if (!dataset) return [];

    // Filter by ownership if user is agent and showAllRecords is false
    let visibleData = dataset;
    const isAgent = ['agente', 'telemarketing'].includes(userRole);
    if (isAgent && !showAllRecords && !searchInAllTables) {
      visibleData = dataset.filter(item => item.agente_id === user?.id);
    }

    if (!searchTerm) {
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

    const lowerTerm = searchTerm.toLowerCase();

    return visibleData
      .filter(item => {
        const checkValue = (val, fieldName) => {
          if (val === null || val === undefined) return false;
          const strVal = String(val).toLowerCase();
          
          if (fieldName && (fieldName.includes('telefono') || fieldName.includes('phone'))) {
            const cleanVal = strVal.replace(/\D/g, '');
            const cleanTerm = lowerTerm.replace(/\D/g, '');
            if (cleanTerm) {
              return cleanVal.includes(cleanTerm);
            }
          }
          return strVal.includes(lowerTerm);
        };

        return fields.some(field => {
          if (field === 'full_code') {
            const codeVal = `${item.codice || ''}-${item.numero || ''}`;
            const codeValSpace = `${item.codice || ''} - ${item.numero || ''}`;
            return checkValue(codeVal) || checkValue(codeValSpace);
          }
          return checkValue(item[field], field);
        });
      })
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
        ...searchDataset(activities, 'commercial_activities', 'Attività Commerciale', getSearchableFields('commercial_activities')),
        ...searchDataset(properties, 'properties', 'Immobile', getSearchableFields('properties')),
        ...searchDataset(potentialTobacconists, 'potential_tobacconists', 'Potenziale Tabaccheria', getSearchableFields('potential_tobacconists')),
        ...searchDataset(potentialActivities, 'potential_activities', 'Potenziale Acquirente/Venditore', getSearchableFields('potential_activities')),
        ...searchDataset(telemarketing, 'telemarketing_contacts', 'Telemarketing', getSearchableFields('telemarketing_contacts'))
      ];

      // Sort by creation date
      return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 2. Local Search Mode
    let localFiltered = baseData || [];

    // Apply agent ownership filter if showAllRecords is false
    if (isAgent && !showAllRecords) {
      localFiltered = localFiltered.filter(item => item.agente_id === user?.id);
    }

    if (!searchTerm) {
      return localFiltered;
    }

    const lowerTerm = searchTerm.toLowerCase();
    const fields = getSearchableFields(tableName);

    return localFiltered.filter(item => {
      const checkValue = (val, fieldName) => {
        if (val === null || val === undefined) return false;
        const strVal = String(val).toLowerCase();
        
        if (fieldName && (fieldName.includes('telefono') || fieldName.includes('phone'))) {
          const cleanVal = strVal.replace(/\D/g, '');
          const cleanTerm = lowerTerm.replace(/\D/g, '');
          if (cleanTerm) {
            return cleanVal.includes(cleanTerm);
          }
        }
        return strVal.includes(lowerTerm);
      };

      return fields.some(field => {
        if (field === 'full_code') {
          const codeVal = `${item.codice || ''}-${item.numero || ''}`;
          const codeValSpace = `${item.codice || ''} - ${item.numero || ''}`;
          return checkValue(codeVal) || checkValue(codeValSpace);
        }
        return checkValue(item[field], field);
      });
    });
  }, [
    baseData,
    tableName,
    searchTerm,
    showAllRecords,
    searchInAllTables,
    userRole,
    user,
    searchDataset,
    activities,
    properties,
    potentialTobacconists,
    potentialActivities,
    telemarketing
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

// Helper function to resolve the identifier based on the table name
function getRecordIdentifier(record, tableName) {
  if (tableName === 'commercial_activities' || tableName === 'properties') {
    return record.codice ? `${record.codice}-${record.numero}` : `N. ${record.numero || ''}`;
  }
  if (tableName === 'potential_tobacconists') {
    return record.numero_rivendita ? `Riv. ${record.numero_rivendita}` : 'Tabaccheria';
  }
  if (tableName === 'potential_activities') {
    return record.numero ? `N. ${record.numero}` : 'Acq/Vend';
  }
  return 'Contatto';
}

// Helper to resolve the main title/name
function getRecordTitle(record, tableName) {
  if (tableName === 'commercial_activities') {
    return record.categoria || 'Attività Commerciale';
  }
  if (tableName === 'properties') {
    return `${record.nome_proprietario || ''} ${record.cognome_proprietario || ''}`.trim() || 'Immobile';
  }
  if (tableName === 'potential_tobacconists' || tableName === 'potential_activities') {
    return `${record.nome || ''} ${record.cognome || ''}`.trim() || 'Potenziale';
  }
  if (tableName === 'telemarketing_contacts') {
    return record.nome_azienda || `${record.nome || ''} ${record.cognome || ''}`.trim() || 'Contatto Telemarketing';
  }
  return record.title || 'Dettaglio';
}

// Helper to resolve details/subtitle
function getRecordSubtitle(record, tableName) {
  if (tableName === 'commercial_activities' || tableName === 'properties' || tableName === 'potential_tobacconists') {
    return `${record.indirizzo || ''}, ${record.citta || ''}`.trim();
  }
  if (tableName === 'potential_activities') {
    return `${record.email || ''} ${record.telefono || ''}`.trim() || record.note || '';
  }
  if (tableName === 'telemarketing_contacts') {
    return `${record.telefono || ''} | ${record.email || ''} | ${record.citta || ''}`.trim();
  }
  return record.note || '';
}
