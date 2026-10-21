export const searchConfig = {
  commercial_activities: {
    tableName: 'commercial_activities',
    displayName: 'Attività Commerciali',
    searchableFields: [
      'codice', 'numero', 'categoria', 'citta', 'indirizzo', 'zona', 'regione', 'stato', 
      'full_code', 'nome_proprietario', 'cognome_proprietario', 'telefono_proprietario', 
      'phone_2', 'email_proprietario', 'note', 'agent_name'
    ],
    rolePermissions: {
      agente: 'own', // Can only search own data
      telemarketing: 'own',
      admin: 'all',
      super_admin: 'all'
    }
  },
  properties: {
    tableName: 'properties',
    displayName: 'Immobili',
    searchableFields: [
      'codice', 'numero', 'categoria', 'tipologia', 'citta', 'indirizzo', 'zona', 'regione', 'stato', 
      'full_code', 'nome_proprietario', 'cognome_proprietario', 'telefono_proprietario', 
      'phone_2', 'email_proprietario', 'note', 'agent_name'
    ],
    rolePermissions: {
      agente: 'own',
      telemarketing: 'own',
      admin: 'all',
      super_admin: 'all'
    }
  },
  potential_tobacconists: {
    tableName: 'potential_tobacconists',
    displayName: 'Potenziali Tabaccherie',
    searchableFields: [
      'numero_rivendita', 'numero_ricevitoria', 'tipo_rivendita', 'distributore',
      'nome', 'cognome', 'citta', 'zona', 'regione', 'indirizzo', 'telefono', 'phone_2', 
      'email', 'note', 'stato', 'categoria', 'caratteristiche', 'agent_name'
    ],
    rolePermissions: {
      agente: 'own',
      telemarketing: 'own',
      admin: 'all',
      super_admin: 'all'
    }
  },
  potential_activities: {
    tableName: 'potential_activities',
    displayName: 'Potenziali Attività',
    searchableFields: [
      'numero', 'type', 'nome', 'cognome', 'email', 'telefono', 'phone_2', 
      'citta', 'zona', 'regione', 'indirizzo', 'note', 'fonte_chiamata', 
      'anagrafica_type', 'categoria', 'caratteristiche', 'stato', 'agent_name'
    ],
    rolePermissions: {
      agente: 'own',
      telemarketing: 'own',
      admin: 'all',
      super_admin: 'all'
    }
  },
  telemarketing_contacts: {
    tableName: 'telemarketing_contacts',
    displayName: 'Telemarketing',
    searchableFields: [
      'nome_azienda', 'nome', 'cognome', 'telefono', 'phone_2', 'email', 
      'citta', 'indirizzo', 'regione', 'note', 'categoria', 'tipologia', 
      'stato', 'anagrafica_type', 'agent_name'
    ],
    rolePermissions: {
      agente: 'none', // Agents typically don't see raw telemarketing data unless assigned (handled by data context)
      telemarketing: 'all', // Telemarketing role sees all
      admin: 'all',
      super_admin: 'all'
    }
  },
  appointments: {
    tableName: 'appointments',
    displayName: 'Appuntamenti',
    searchableFields: ['title', 'luogo', 'note', 'related_table', 'agent_name'],
    rolePermissions: {
      agente: 'own',
      telemarketing: 'all',
      admin: 'all',
      super_admin: 'all'
    }
  }
};

export const getSearchableFields = (tableName) => {
  return searchConfig[tableName]?.searchableFields || [];
};

export const getRolePermission = (tableName, role) => {
  const config = searchConfig[tableName];
  if (!config) return 'none';
  return config.rolePermissions[role] || 'none';
};