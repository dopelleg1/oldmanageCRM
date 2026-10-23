import { getSearchableFields } from './searchConfig.js';

/**
 * Normalizes phone digits by removing non-digits and stripping
 * international prefix (0039 or 39) if sufficient digits remain.
 */
export const normalizePhone = (digits) => {
  if (!digits) return '';
  if (digits.startsWith('0039') && digits.length >= 10) {
    return digits.slice(4);
  }
  if (digits.startsWith('39') && digits.length >= 10) {
    return digits.slice(2);
  }
  return digits;
};

/**
 * Universal matcher for CRM records across all tables.
 * Accurately supports:
 * - Multi-word tokens with AND semantics across fields (e.g. "Mario Rossi", "Bar Milano")
 * - Reversed names ("Rossi Mario" matching nome: Mario, cognome: Rossi)
 * - Phone numbers in all formats (+39 340 1234567, 3401234567, 02/123456, partials)
 * - Record codes & numbers ("C102", "C-102", "C 102", "N 102", "102")
 * - Rivendita codes ("Riv. 12", "Rivendita 12", "T12", "12")
 * - Agent names
 * - Substring matching across notes, address, city, category, email, etc.
 */
export const matchRecord = (item, tableName, searchTerm, agentMap = {}) => {
  if (!searchTerm || !searchTerm.trim()) return true;
  if (!item) return false;

  const rawTerm = searchTerm.trim().toLowerCase();
  const tokens = rawTerm.split(/\s+/).filter(Boolean);
  const cleanTermDigits = rawTerm.replace(/\D/g, '');
  const normTermPhone = normalizePhone(cleanTermDigits);

  const fields = getSearchableFields(tableName);
  const textValues = [];
  const phoneValues = [];

  for (const f of fields) {
    const val = item[f];
    if (val !== null && val !== undefined && val !== '') {
      const s = String(val).toLowerCase();
      textValues.push(s);
      if (f.includes('telefono') || f.includes('phone')) {
        const d = s.replace(/\D/g, '');
        if (d) {
          phoneValues.push({ raw: s, digits: d, norm: normalizePhone(d) });
        }
      }
    }
  }

  // Include agent name
  const agentName = item.agent_name || (item.agente_id && agentMap[item.agente_id]);
  if (agentName) {
    textValues.push(String(agentName).toLowerCase());
  }

  // Synthetic combined full names (both directions: First Last & Last First)
  const firstName = item.nome || item.nome_proprietario || '';
  const lastName = item.cognome || item.cognome_proprietario || '';
  if (firstName || lastName) {
    const fn1 = `${firstName} ${lastName}`.trim().toLowerCase();
    const fn2 = `${lastName} ${firstName}`.trim().toLowerCase();
    if (fn1) textValues.push(fn1);
    if (fn2) textValues.push(fn2);
  }

  // Company / Business name if present
  if (item.nome_azienda) {
    textValues.push(String(item.nome_azienda).toLowerCase());
  }

  // Synthetic codes and numbers (e.g. C-102, C102, C 102, N. 102)
  if (item.codice || item.numero !== undefined) {
    const c = String(item.codice || '').trim().toLowerCase();
    const n = item.numero !== undefined && item.numero !== null ? String(item.numero).trim() : '';
    if (c && n) {
      textValues.push(`${c}-${n}`);
      textValues.push(`${c} - ${n}`);
      textValues.push(`${c}${n}`);
      textValues.push(`${c} ${n}`);
      textValues.push(`n. ${n}`);
      textValues.push(`n.${n}`);
      textValues.push(`n ${n}`);
      textValues.push(n);
    } else if (n) {
      textValues.push(`n. ${n}`);
      textValues.push(`n.${n}`);
      textValues.push(`n ${n}`);
      textValues.push(n);
    }
  }

  // Synthetic rivendita codes for tabaccherie
  if (item.numero_rivendita !== undefined && item.numero_rivendita !== null) {
    const r = String(item.numero_rivendita).trim();
    textValues.push(`riv. ${r}`);
    textValues.push(`riv.${r}`);
    textValues.push(`riv ${r}`);
    textValues.push(`rivendita ${r}`);
    textValues.push(`t${r}`);
    textValues.push(`t ${r}`);
    textValues.push(r);
  }

  // 1. Phone number matching (if search query contains at least 3 digits)
  if (cleanTermDigits && cleanTermDigits.length >= 3) {
    for (const pv of phoneValues) {
      if (pv.digits.includes(cleanTermDigits)) return true;
      if (normTermPhone && pv.norm.includes(normTermPhone)) return true;
      if (normTermPhone && normTermPhone.length >= 6 && normTermPhone.includes(pv.norm)) return true;
    }

    // Check if phone digits appear in notes/address/other text fields when term has >= 5 digits
    if (cleanTermDigits.length >= 5) {
      for (const tv of textValues) {
        const tvDigits = tv.replace(/\D/g, '');
        if (tvDigits && (tvDigits.includes(cleanTermDigits) || (normTermPhone && tvDigits.includes(normTermPhone)))) {
          return true;
        }
      }
    }
  }

  // 2. Direct exact or substring match of entire rawTerm in any text value
  if (textValues.some(tv => tv.includes(rawTerm))) {
    return true;
  }

  // 3. Multi-token match: EVERY word typed by the user must match at least one field
  if (tokens.length > 1) {
    const allTokensMatch = tokens.every(token => {
      const tokenDigits = token.replace(/\D/g, '');
      if (tokenDigits && tokenDigits.length >= 3) {
        const normToken = normalizePhone(tokenDigits);
        const matchesPhone = phoneValues.some(pv => 
          pv.digits.includes(tokenDigits) || (normToken && pv.norm.includes(normToken))
        );
        if (matchesPhone) return true;
      }
      return textValues.some(tv => tv.includes(token));
    });

    if (allTokensMatch) return true;
  }

  return false;
};

// Helper function to resolve the identifier based on the table name
export function getRecordIdentifier(record, tableName) {
  if (tableName === 'commercial_activities' || tableName === 'properties') {
    return record.codice ? `${record.codice}-${record.numero}` : `N. ${record.numero || ''}`;
  }
  if (tableName === 'potential_tobacconists') {
    return record.numero_rivendita ? `Riv. ${record.numero_rivendita}` : 'Tabaccheria';
  }
  if (tableName === 'potential_activities') {
    return record.numero ? `N. ${record.numero}` : 'Acq/Vend';
  }
  if (tableName === 'appointments') {
    return 'Appuntamento';
  }
  return 'Contatto';
}

// Helper to resolve the main title/name
export function getRecordTitle(record, tableName) {
  if (tableName === 'commercial_activities') {
    const ownerName = `${record.nome_proprietario || ''} ${record.cognome_proprietario || ''}`.trim();
    if (ownerName && record.categoria) return `${record.categoria} - ${ownerName}`;
    return ownerName || record.categoria || 'Attività Commerciale';
  }
  if (tableName === 'properties') {
    const ownerName = `${record.nome_proprietario || ''} ${record.cognome_proprietario || ''}`.trim();
    if (ownerName && record.categoria) return `${record.categoria} - ${ownerName}`;
    return ownerName || record.categoria || 'Immobile';
  }
  if (tableName === 'potential_tobacconists' || tableName === 'potential_activities') {
    return `${record.nome || ''} ${record.cognome || ''}`.trim() || 'Potenziale';
  }
  if (tableName === 'telemarketing_contacts') {
    const contactName = `${record.nome || ''} ${record.cognome || ''}`.trim();
    if (record.nome_azienda && contactName) return `${record.nome_azienda} (${contactName})`;
    return record.nome_azienda || contactName || 'Contatto Telemarketing';
  }
  if (tableName === 'appointments') {
    return record.title || 'Appuntamento';
  }
  return record.title || 'Dettaglio';
}

// Helper to resolve details/subtitle
export function getRecordSubtitle(record, tableName) {
  if (tableName === 'appointments') {
    const timeStr = record.start_time ? new Date(record.start_time).toLocaleString('it-IT') : '';
    return [timeStr, record.luogo, record.note].filter(Boolean).join(' | ');
  }

  const phones = [record.telefono_proprietario || record.telefono, record.phone_2].filter(Boolean).join(' / ');
  const geo = [record.indirizzo, record.citta, record.zona].filter(Boolean).join(', ');
  
  const parts = [];
  if (phones) parts.push(phones);
  if (geo) parts.push(geo);
  if (record.email || record.email_proprietario) parts.push(record.email || record.email_proprietario);
  
  return parts.join(' | ') || record.note || '';
}
