import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Map, Stethoscope, Search, RefreshCw, Trash2, Filter, ExternalLink, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { DataTable } from '@/components/ui/data-table';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import RecordDetailModal from '@/components/calendar/RecordDetailModal';
import ImportModal from '@/components/import/ImportModal';
import RemapCoordinatesModal from '@/components/RemapCoordinatesModal';
import AdminTableToolbar from '@/components/admin/AdminTableToolbar';
import DuplicatesManagementModal from '@/components/duplicates/DuplicatesManagementModal';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { exportTableToCSV } from '@/utils/csvExportService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import SearchBar from '@/components/search/SearchBar';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import UnifiedSearchResultsTable from '@/components/search/UnifiedSearchResultsTable';
import { useSearchStateManager } from '@/hooks/useSearchStateManager';
import { usePageStateManager } from '@/hooks/usePageStateManager';
import { RingLoader } from 'react-spinners';

const PotentialActivitiesPage = () => {
    const { toast } = useToast();
    const { potentialActivities, loading, fetchAllData, fetchTable, updateRecord } = useData();
    const { user, userRole } = useAuth();
    
    // Search State Management
    const { searchState, saveSearchState, clearSearchState, hasPersistedState } = useSearchStateManager('potential_activities');
    const { saveState: savePageState, loadState: loadPageState } = usePageStateManager('potential_activities_pageState');
    const [cachedResults, setCachedResults] = useState(searchState?.searchResults || null);
    const [isRestored, setIsRestored] = useState(false);
    const [pageIndex, setPageIndex] = useState(0);

    // UI State initialized from cache if available
    const [currentTab, setCurrentTab] = useState(searchState?.filters?.currentTab || "all");

    const [selectedRecord, setSelectedRecord] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isRemapModalOpen, setIsRemapModalOpen] = useState(false);
    const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const documentManagerRef = useRef();

    // 1. Filter by Tab first
    const tabFilteredData = useMemo(() => {
        if (!potentialActivities) return [];
        if (currentTab === 'all') return potentialActivities;
        return potentialActivities.filter(item => (item.type || '').toLowerCase() === currentTab);
    }, [potentialActivities, currentTab]);

    // 2. Apply Unified Search
    const {
        searchTerm,
        setSearchTerm,
        showAllRecords,
        setShowAllRecords,
        searchInAllTables,
        setSearchInAllTables,
        filteredData,
        isGlobalSearchActive,
        totalCount,
        filteredCount
    } = useUnifiedSearch(tabFilteredData, 'potential_activities');

    // Restore state on mount
    useEffect(() => {
        const savedPage = loadPageState();
        if (savedPage) {
            if (savedPage.currentPage !== undefined) setPageIndex(savedPage.currentPage);
            if (savedPage.searchTerm !== undefined) setSearchTerm(savedPage.searchTerm);
            if (savedPage.filters) {
                if (savedPage.filters.currentTab !== undefined) setCurrentTab(savedPage.filters.currentTab);
                if (savedPage.filters.showAllRecords !== undefined) setShowAllRecords(savedPage.filters.showAllRecords);
                if (savedPage.filters.searchInAllTables !== undefined) setSearchInAllTables(savedPage.filters.searchInAllTables);
            }
        }
        setIsRestored(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Save page state
    useEffect(() => {
        if (isRestored) {
            savePageState({
                currentPage: pageIndex,
                searchTerm: searchTerm || "",
                filters: { currentTab, showAllRecords, searchInAllTables },
                sortBy: [],
                expandedRows: {}
            });
        }
    }, [pageIndex, currentTab, searchTerm, showAllRecords, searchInAllTables, isRestored, savePageState]);

    // Save search state when filters or data change
    useEffect(() => {
        if (!loading && isRestored) {
            saveSearchState(filteredData, { currentTab, showAllRecords, searchInAllTables }, 1, searchTerm);
            setCachedResults(filteredData);
        }
    }, [currentTab, showAllRecords, searchInAllTables, filteredData, loading, isRestored, saveSearchState, searchTerm]);

    const handleClearFilters = () => {
        clearSearchState();
        setCurrentTab("all");
        setSearchTerm('');
        setShowAllRecords(false);
        setSearchInAllTables(false);
        setCachedResults(null);
        setPageIndex(0);
        toast({ title: "Filtri azzerati", description: "La vista è stata ripristinata allo stato iniziale." });
    };

    // Counts for cards
    const counts = useMemo(() => {
        if (!potentialActivities) return { all: 0, acquirente: 0, venditore: 0 };
        return {
            all: potentialActivities.length,
            acquirente: potentialActivities.filter(i => (i.type || '').toLowerCase() === 'acquirente').length,
            venditore: potentialActivities.filter(i => (i.type || '').toLowerCase() === 'venditore').length
        };
    }, [potentialActivities]);

    const handleImportSuccess = async () => { 
        toast({ title: "Importazione completata!" }); 
        await fetchTable('potential_activities', true); 
    };
    
    const handleRemapClose = async () => { setIsRemapModalOpen(false); await fetchTable('potential_activities', true); };

    const displayData = (loading && cachedResults) ? cachedResults : filteredData;
    const isActuallyLoading = loading && !cachedResults;

    const handleExport = async () => {
        try {
            if (!displayData || displayData.length === 0) {
                toast({ title: "Attenzione", description: "Nessun dato da esportare.", variant: "warning" });
                return;
            }
            toast({ title: "Export in corso..." });
            await exportTableToCSV('potential_activities', displayData);
            toast({ title: "Export completato", variant: "success" });
        } catch (error) {
            toast({ title: "Errore Export", variant: "destructive" });
        }
    };

    const handleDeleteAll = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('potential_activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            toast({ title: "Tabella svuotata", description: "Dati eliminati." }); 
            await fetchTable('potential_activities', true); 
        } catch (error) {
            toast({ title: "Errore Cancellazione", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSwitchToRecord = async (recordId) => {
        toast({ title: "Caricamento record...", description: "Reindirizzamento..." });
        try {
            const { data, error } = await supabase.from('potential_activities').select('*').eq('id', recordId).single();
            if (error) throw error;
            if (data) {
                data.recordType = 'Potenziale Acquirente/Venditore';
                setSelectedRecord(data);
                setIsDetailModalOpen(true);
            }
        } catch (error) {
            toast({ title: "Errore", description: "Impossibile caricare il record.", variant: "destructive" });
        }
    };

    const handleSaveNew = async (editedRecord, pendingFiles = []) => {
        try {
            const { recordType, full_code, agent_name, ...recordToSave } = editedRecord;
            if (!recordToSave.stato) recordToSave.stato = 'Da contattare';
            if (!recordToSave.agente_id) recordToSave.agente_id = user?.id;

            const { data: newRecord, error } = await supabase.from('potential_activities').insert(recordToSave).select().single();

            if (error) throw error;

            if (pendingFiles.length > 0 && newRecord.id) {
                for (const file of pendingFiles) {
                    const filePath = `potential_activities/${newRecord.id}/${Date.now()}-${file.name}`;
                    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
                    if (uploadError) continue;
                    await supabase.from('documents').insert({
                        record_id: newRecord.id,
                        table_name: 'potential_activities',
                        file_name: file.name,
                        file_path: filePath,
                        file_type: file.type,
                        file_size: file.size,
                        uploaded_by: user.id
                    });
                }
            }
            toast({ title: "Salvato!", className: "bg-green-50 border-green-200 text-green-900" });
            await fetchTable('potential_activities', true);
            return { success: true };
        } catch (error) {
            toast({ title: "Errore", description: error.message, variant: "destructive" });
            return { success: false };
        }
    };

    const handleSaveUpdate = async (editedRecord) => {
        try {
            const { recordType, full_code, agent_name, ...recordToSave } = editedRecord;
            
            const { data, error } = await supabase
                .from('potential_activities')
                .update(recordToSave)
                .eq('id', recordToSave.id)
                .select();
                
            if (error) throw error;
            if (documentManagerRef.current?.uploadDirectly) await documentManagerRef.current.uploadDirectly(recordToSave.id);

            const { data: freshRecord, error: fetchError } = await supabase
                .from('potential_activities')
                .select('*')
                .eq('id', recordToSave.id)
                .single();

            if (!fetchError && freshRecord) {
                updateRecord('potential_activities', freshRecord);
            }

            toast({ title: "Aggiornato!", className: "bg-green-50 border-green-200 text-green-900" });
            await fetchTable('potential_activities', true);
            
            return { success: true };
        } catch (error) {
            toast({ title: "Errore", description: error.message, variant: "destructive" });
            return { success: false };
        }
    };

    const columns = useMemo(() => [
        { 
            accessorKey: 'numero', 
            header: 'ID',
            cell: ({ row }) => <span className="font-mono text-xs font-bold text-gray-500">#{row.getValue("numero") || "-"}</span>
        },
        { 
            accessorKey: 'type', 
            header: 'Tipo',
            cell: ({ row }) => {
                const val = row.getValue("type");
                const label = val ? val.charAt(0).toUpperCase() + val.slice(1) : "N/D";
                const isAcquirente = (val || '').toLowerCase() === 'acquirente';
                return (
                    <Badge variant={isAcquirente ? "default" : "secondary"} className={isAcquirente ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>
                        {label}
                    </Badge>
                );
            }
        },
        { accessorKey: 'nome', header: 'Nome' },
        { accessorKey: 'cognome', header: 'Cognome' },
        { 
            accessorKey: 'telefono', 
            header: 'Telefoni',
            cell: ({ row }) => {
                const phone1 = row.original.telefono;
                const phone2 = row.original.phone_2;
                return (
                    <div className="flex flex-col gap-1 text-sm">
                        {phone1 && <a href={`tel:${phone1}`} className="text-blue-600 hover:underline">{phone1}</a>}
                        {phone2 && <a href={`tel:${phone2}`} className="text-blue-600 hover:underline">{phone2}</a>}
                        {!phone1 && !phone2 && <span className="text-gray-400">-</span>}
                    </div>
                );
            }
        },
        { 
            accessorKey: 'budget', 
            header: 'Budget/Ricavo',
            cell: ({ row }) => {
                const val = row.getValue("budget");
                const ricavo = row.original.ricavo;
                const type = (row.original.type || '').toLowerCase();
                if (type === 'venditore' && ricavo) return `€ ${Number(ricavo).toLocaleString('it-IT')}`;
                if (val) return `€ ${Number(val).toLocaleString('it-IT')}`;
                return "-";
            }
        },
        { accessorKey: 'zona', header: 'Zona' },
        { accessorKey: 'citta', header: 'Città' },
        { 
            accessorKey: 'allegati_urls', 
            header: 'Allegati',
            cell: ({ row }) => {
                const record = row.original;
                const urls = record.allegati_urls;
                
                let list = [];
                if (urls) {
                    try { 
                        list = typeof urls === 'string' ? JSON.parse(urls) : (Array.isArray(urls) ? urls : []); 
                    } catch(e) {}
                }
                
                if (!Array.isArray(list) || list.length === 0) {
                    return <span className="text-gray-400">-</span>;
                }
                
                return (
                    <a href={list[0]} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center text-xs">
                        <ExternalLink className="w-3 h-3 mr-1"/> {list.length} {list.length === 1 ? 'link' : 'links'}
                    </a>
                );
            }
        },
        { id: "actions", cell: ({ row }) => <Button variant="ghost" size="sm" onClick={() => { setSelectedRecord(row.original); setIsDetailModalOpen(true); }}>Dettagli</Button> }
    ], []);

    const searchFields = [
        { name: 'nome', label: 'Nome' },
        { name: 'cognome', label: 'Cognome' },
        { name: 'citta', label: 'Città' },
        { name: 'indirizzo', label: 'Indirizzo' },
        { name: 'note', label: 'Note' }
    ];

    if (isActuallyLoading) {
        return <div className="flex items-center justify-center h-screen"><RingLoader color={"#36d7b7"} loading={loading} size={150} /></div>;
    }

    return (
        <>
            <Helmet><title>Potenziali Attività</title></Helmet>
            <div className="container mx-auto py-10 space-y-6">
                
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            Potenziali Attività 
                            <span className="text-sm font-normal text-muted-foreground bg-slate-100 px-2 py-1 rounded-full border">
                                {loading ? '...' : `${counts.all} record`}
                            </span>
                        </h1>
                        <p className="text-muted-foreground mt-1">Gestione completa acquirenti e venditori.</p>
                    </div>
                    
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                        <div className="flex flex-col sm:flex-row gap-2 w-full items-center">
                            <SearchBar 
                                onSearch={setSearchTerm} 
                                placeholder="Cerca potenziali..." 
                                resultsCount={filteredCount}
                                totalCount={totalCount}
                                defaultValue={searchTerm}
                                className="w-full md:w-64"
                            />
                            
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsRemapModalOpen(true)}>
                                    <Map className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Rimappa</span>
                                </Button>
                                <Button onClick={() => { setSelectedRecord({ recordType: 'Potenziale Acquirente/Venditore' }); setIsDetailModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                                    <Plus className="mr-2 h-4 w-4"/> <span className="hidden sm:inline">Aggiungi</span>
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 items-center px-1 text-xs text-muted-foreground mt-1">
                          {['agente', 'telemarketing'].includes(userRole) && (
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input 
                                type="checkbox" 
                                checked={showAllRecords} 
                                onChange={(e) => setShowAllRecords(e.target.checked)}
                                className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                              />
                              Mostra record di altri agenti (sola lettura)
                            </label>
                          )}
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={searchInAllTables} 
                              onChange={(e) => setSearchInAllTables(e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                            />
                            Cerca in tutte le tabelle
                          </label>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card><CardContent className="p-4 flex justify-between"><div><p className="text-sm text-muted-foreground">Totale</p><h3 className="text-2xl font-bold">{counts.all}</h3></div><ActivityIcon className="h-8 w-8 text-slate-300" /></CardContent></Card>
                    <Card><CardContent className="p-4 flex justify-between"><div><p className="text-sm text-muted-foreground">Acquirenti</p><h3 className="text-2xl font-bold text-blue-600">{counts.acquirente}</h3></div><Search className="h-8 w-8 text-blue-200" /></CardContent></Card>
                    <Card><CardContent className="p-4 flex justify-between"><div><p className="text-sm text-muted-foreground">Venditori</p><h3 className="text-2xl font-bold text-orange-600">{counts.venditore}</h3></div><StoreIcon className="h-8 w-8 text-orange-200" /></CardContent></Card>
                </div>

                <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
                         <Tabs defaultValue="all" value={currentTab} onValueChange={setCurrentTab} className="w-full md:w-auto">
                            <TabsList>
                                <TabsTrigger value="all">Tutti</TabsTrigger>
                                <TabsTrigger value="acquirente">Acquirenti</TabsTrigger>
                                <TabsTrigger value="venditore">Venditori</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex gap-2 w-full md:w-auto justify-end">


                            <Button variant="outline" size="icon" onClick={() => fetchTable('potential_activities', true)} title="Ricarica">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                            
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" title="Elimina Tutto">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Confermi?</AlertDialogTitle><AlertDialogDescription>Svuoterà l'intera tabella.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAll} className="bg-red-600">Conferma</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                    
                    <AdminTableToolbar 
                        tableName="Potenziali Attività" 
                        onImport={() => setIsImportModalOpen(true)} 
                        onExport={handleExport}
                        onDeleteAll={handleDeleteAll} 
                        onFindDuplicates={() => setIsDuplicatesModalOpen(true)}
                        hideSearch={true} 
                    />



                    <div className="relative">
                        {loading && cachedResults && (
                            <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded shadow z-10 m-2 flex items-center gap-1">
                                <RingLoader color={"#2563eb"} size={12} /> Aggiornamento in corso...
                            </div>
                        )}
                        {isGlobalSearchActive ? (
                            <UnifiedSearchResultsTable 
                                results={displayData}
                                onRowClick={(originalRecord) => {
                                    setSelectedRecord(originalRecord);
                                    setIsDetailModalOpen(true);
                                }}
                            />
                        ) : (
                            <DataTable 
                                columns={columns} 
                                data={displayData} 
                                pageIndex={pageIndex}
                                onPageIndexChange={setPageIndex}
                            />
                        )}
                    </div>
                </div>
            </div>

            {selectedRecord && (
                <RecordDetailModal 
                    ref={documentManagerRef}
                    isOpen={isDetailModalOpen} 
                    onClose={() => setIsDetailModalOpen(false)} 
                    record={selectedRecord} 
                    onSave={!selectedRecord.id ? handleSaveNew : handleSaveUpdate} 
                    isAdding={!selectedRecord.id} 
                    startInEditMode={!selectedRecord.id}
                    tableName="potential_activities"
                    onSwitchToRecord={handleSwitchToRecord}
                />
            )}
            
            <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImportSuccess={handleImportSuccess} tableName="potential_activities"/>
            <RemapCoordinatesModal tableName="potential_activities" isOpen={isRemapModalOpen} onClose={handleRemapClose} />
            
            <DuplicatesManagementModal 
                isOpen={isDuplicatesModalOpen}
                onClose={() => setIsDuplicatesModalOpen(false)}
                tableName="potential_activities"
                keyField="telefono"
                onComplete={() => fetchTable('potential_activities', true)}
            />
        </>
    );
};

const ActivityIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
)
const StoreIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>
)

export default PotentialActivitiesPage;