import React, { useState, useMemo } from 'react';
import { Menu, Search, X, Loader2, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDraftAutoSave'; 
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import {
  matchRecord,
  getRecordIdentifier,
  getRecordTitle,
  getRecordSubtitle
} from '@/utils/recordMatcher';
import { Badge } from '@/components/ui/badge';

const getBadgeStyle = (typeName) => {
  switch (typeName) {
    case 'Acquirente':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Venditore':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Attività Commerciale':
      return 'bg-slate-100 text-slate-800 border-slate-200';
    case 'Immobile':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Potenziale Tabaccheria':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Telemarketing':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Appuntamento':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const Header = ({ setSidebarOpen }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activities,
    properties,
    potentialTobacconists,
    potentialActivities,
    telemarketing,
    appointments,
    agents,
    loading: dataLoading
  } = useData();

  // Fast debounce for snappy client-side search
  const debouncedTerm = useDebounce(globalSearchTerm, 150);

  // Agent name map
  const agentMap = useMemo(() => {
    if (!agents) return {};
    return agents.reduce((acc, a) => ({ ...acc, [a.id]: a.name }), {});
  }, [agents]);

  // Client-side instant global search across all CRM tables
  const results = useMemo(() => {
    const term = debouncedTerm ? debouncedTerm.trim() : '';
    if (!term || term.length < 2) return [];

    const datasets = [
      {
        data: potentialActivities,
        table: 'potential_activities',
        route: '/potential-activities',
        getType: (item) => item.type === 'venditore' ? 'Venditore' : 'Acquirente'
      },
      {
        data: activities,
        table: 'commercial_activities',
        route: '/activities',
        getType: () => 'Attività Commerciale'
      },
      {
        data: properties,
        table: 'properties',
        route: '/properties',
        getType: () => 'Immobile'
      },
      {
        data: potentialTobacconists,
        table: 'potential_tobacconists',
        route: '/potential-tobacconists',
        getType: () => 'Potenziale Tabaccheria'
      },
      {
        data: telemarketing,
        table: 'telemarketing_contacts',
        route: '/telemarketing',
        getType: () => 'Telemarketing'
      },
      {
        data: appointments,
        table: 'appointments',
        route: '/calendar',
        getType: () => 'Appuntamento'
      }
    ];

    const matches = [];
    for (const ds of datasets) {
      if (!ds.data || !Array.isArray(ds.data)) continue;
      for (const item of ds.data) {
        if (matchRecord(item, ds.table, term, agentMap)) {
          matches.push({
            id: item.id,
            table: ds.table,
            route: ds.route,
            type: ds.getType(item),
            identifier: getRecordIdentifier(item, ds.table),
            title: getRecordTitle(item, ds.table),
            subtitle: getRecordSubtitle(item, ds.table),
            originalRecord: item
          });
          if (matches.length >= 25) break;
        }
      }
      if (matches.length >= 25) break;
    }

    return matches;
  }, [debouncedTerm, potentialActivities, activities, properties, potentialTobacconists, telemarketing, appointments, agentMap]);

  const handleResultClick = (result) => {
    setGlobalSearchTerm('');
    setIsSearchOpen(false);

    // Resolve target search term for the destination page
    const searchTermTarget = result.originalRecord?.numero 
      ? String(result.originalRecord.numero)
      : (result.originalRecord?.telefono || result.identifier || debouncedTerm);

    navigate(result.route, {
      state: {
        selectedRecordId: result.id,
        selectedRecord: result.originalRecord,
        searchTerm: searchTermTarget
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (results.length > 0) {
        handleResultClick(results[0]);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  const handleClear = () => {
    setGlobalSearchTerm('');
    setIsSearchOpen(false);
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Hamburger menu button - Visible only on mobile (<768px) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-gray-500 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          {/* Studio BP horizontal logo */}
          <Link to="/" className="md:hidden text-gray-800 dark:text-white truncate">
            <img
              src="https://horizons-cdn.hostinger.com/82c787d0-7626-4a6c-b758-36c02c602514/82eeb5bc7de1efa20007d0d7b6aa676b.webp"
              alt="Studio BP Business & Houses Logo"
              className="h-9 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Global Search Bar (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-xl mx-auto relative">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cerca globalmente (nome, numero, telefono, codice, città)..." 
              className="pl-9 pr-9 w-full bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:bg-white transition-colors"
              value={globalSearchTerm}
              onChange={(e) => {
                setGlobalSearchTerm(e.target.value);
                if (e.target.value) setIsSearchOpen(true);
              }}
              onFocus={() => {
                if (globalSearchTerm) setIsSearchOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 250)}
            />
            {globalSearchTerm && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                title="Cancella ricerca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Dropdown Results */}
          {isSearchOpen && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-md shadow-xl border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto z-50">
              <div className="p-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 sticky top-0 flex justify-between items-center border-b">
                <span>Risultati ({results.length})</span>
                <span className="text-[10px] lowercase text-muted-foreground">Premi invio per aprire il 1°</span>
              </div>
              {results.map((result, idx) => (
                <div 
                  key={idx}
                  className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700/60 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition-colors"
                  onClick={() => handleResultClick(result)}
                  onMouseDown={(e) => e.preventDefault()} // Prevent blur before click fires
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <Badge variant="outline" className={cn("text-xs font-medium border", getBadgeStyle(result.type))}>
                        {result.type}
                      </Badge>
                      <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {result.title}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">
                      {result.identifier}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                    {result.subtitle}
                  </p>
                </div>
              ))}
            </div>
          )}

          {isSearchOpen && debouncedTerm.trim().length >= 2 && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-center text-sm text-muted-foreground z-50">
              Nessun risultato trovato per "{debouncedTerm}".
            </div>
          )}
        </div>
        
        {/* Placeholder for right side */}
        <div className="w-10"></div>
      </div>
    </header>
  );
};

export default Header;
