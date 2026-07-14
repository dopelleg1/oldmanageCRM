import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Loader2, 
    RefreshCw, 
    AlertTriangle, 
    CheckCircle, 
    Wrench, 
    Database, 
    UserX, 
    MapPinOff, 
    ClipboardList,
    Layers,
    FileWarning,
    UserCheck
} from 'lucide-react';

const TablesDiagnosticPanel = () => {
    const { toast } = useToast();
    const { 
        activities, 
        properties, 
        potentialTobacconists, 
        potentialActivities, 
        telemarketing, 
        appointments,
        agents,
        fetchAllData 
    } = useData();

    const [scanning, setScanning] = useState(false);
    const [fixingEdge, setFixingEdge] = useState(false);
    const [selectedTab, setSelectedTab] = useState('overview');

    // Stats for Potential Activities Edge Function Diagnostics
    const [edgeStats, setEdgeStats] = useState(null);
    const [loadingEdge, setLoadingEdge] = useState(false);

    const fetchEdgeStats = async () => {
        setLoadingEdge(true);
        try {
            const { data, error } = await supabase.functions.invoke('check-potential-activities');
            if (error) throw error;
            if (data.success) {
                setEdgeStats(data.stats);
            }
        } catch (err) {
            console.error("Error fetching Edge Stats:", err);
        } finally {
            setLoadingEdge(false);
        }
    };

    const fixPotentialActivitiesEdge = async () => {
        setFixingEdge(true);
        try {
            const { data, error } = await supabase.functions.invoke('fix-potential-activities-types');
            if (error) throw error;
            if (!data.success) throw new Error(data.error || "Errore correzione");
            toast({
                title: "Correzione Completata",
                description: `Aggiornati ${data.results.totalFixed} record in Potenziali Attività.`,
                variant: "success"
            });
            await fetchEdgeStats();
            await fetchAllData();
        } catch (err) {
            toast({
                title: "Errore Correzione",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setFixingEdge(false);
        }
    };

    useEffect(() => {
        fetchEdgeStats();
    }, []);

    // Create a map of active agent IDs for quick lookup
    const agentMap = useMemo(() => {
        const map = {};
        if (agents) {
            agents.forEach(a => {
                map[a.id] = a.name || a.email;
            });
        }
        return map;
    }, [agents]);

    // Client-side diagnostic scan
    const diagnostics = useMemo(() => {
        setScanning(true);
        
        const results = {
            properties: { total: 0, issues: [], stats: { missingAgent: 0, missingCoords: 0, missingBasicInfo: 0 } },
            activities: { total: 0, issues: [], stats: { missingAgent: 0, missingCoords: 0, missingBasicInfo: 0 } },
            potentialTobacconists: { total: 0, issues: [], stats: { missingAgent: 0, missingCoords: 0, missingBasicInfo: 0 } },
            potentialActivities: { total: 0, issues: [], stats: { missingAgent: 0, missingCoords: 0, missingType: 0, invalidType: 0 } },
            telemarketing: { total: 0, issues: [], stats: { missingAgent: 0, missingBasicInfo: 0 } },
            appointments: { total: 0, issues: [], stats: { missingAgent: 0, orphanedRef: 0 } }
        };

        // 1. Properties
        if (properties) {
            results.properties.total = properties.length;
            properties.forEach(item => {
                const code = item.codice || item.numero || item.id;
                let hasIssue = false;
                
                if (!item.agente_id || !agentMap[item.agente_id]) {
                    results.properties.stats.missingAgent++;
                    results.properties.issues.push({
                        id: item.id,
                        identifier: `Cod. ${code}`,
                        type: 'error',
                        message: 'Agente non assegnato o ID non valido.',
                        field: 'agente_id'
                    });
                }
                if (!item.lat || !item.lng) {
                    results.properties.stats.missingCoords++;
                    results.properties.issues.push({
                        id: item.id,
                        identifier: `Cod. ${code}`,
                        type: 'warning',
                        message: 'Coordinate geografiche mancanti (Impossibile rimappare sulla mappa).',
                        field: 'coordinate'
                    });
                }
                if (!item.citta || !item.indirizzo) {
                    results.properties.stats.missingBasicInfo++;
                    results.properties.issues.push({
                        id: item.id,
                        identifier: `Cod. ${code}`,
                        type: 'warning',
                        message: 'Città o Indirizzo mancanti.',
                        field: 'indirizzo'
                    });
                }
            });
        }

        // 2. Commercial Activities
        if (activities) {
            results.activities.total = activities.length;
            activities.forEach(item => {
                const code = item.codice || item.numero || item.id;
                
                if (!item.agente_id || !agentMap[item.agente_id]) {
                    results.activities.stats.missingAgent++;
                    results.activities.issues.push({
                        id: item.id,
                        identifier: `Cod. ${code}`,
                        type: 'error',
                        message: 'Agente non assegnato o ID non valido.',
                        field: 'agente_id'
                    });
                }
                if (!item.lat || !item.lng) {
                    results.activities.stats.missingCoords++;
                    results.activities.issues.push({
                        id: item.id,
                        identifier: `Cod. ${code}`,
                        type: 'warning',
                        message: 'Coordinate geografiche mancanti.',
                        field: 'coordinate'
                    });
                }
                if (!item.citta || !item.categoria) {
                    results.activities.stats.missingBasicInfo++;
                    results.activities.issues.push({
                        id: item.id,
                        identifier: `Cod. ${code}`,
                        type: 'warning',
                        message: 'Città o Categoria commerciale mancante.',
                        field: 'info'
                    });
                }
            });
        }

        // 3. Potential Tobacconists
        if (potentialTobacconists) {
            results.potentialTobacconists.total = potentialTobacconists.length;
            potentialTobacconists.forEach(item => {
                const identifier = item.numero_rivendita ? `Riv. ${item.numero_rivendita}` : `${item.nome || ''} ${item.cognome || ''}`.trim() || item.id;
                
                if (!item.agente_id || !agentMap[item.agente_id]) {
                    results.potentialTobacconists.stats.missingAgent++;
                    results.potentialTobacconists.issues.push({
                        id: item.id,
                        identifier,
                        type: 'error',
                        message: 'Agente non assegnato o ID non valido.',
                        field: 'agente_id'
                    });
                }
                if (!item.lat || !item.lng) {
                    results.potentialTobacconists.stats.missingCoords++;
                    results.potentialTobacconists.issues.push({
                        id: item.id,
                        identifier,
                        type: 'warning',
                        message: 'Coordinate geografiche mancanti.',
                        field: 'coordinate'
                    });
                }
                if (!item.numero_rivendita || !item.citta) {
                    results.potentialTobacconists.stats.missingBasicInfo++;
                    results.potentialTobacconists.issues.push({
                        id: item.id,
                        identifier,
                        type: 'warning',
                        message: 'Numero rivendita o Città mancanti.',
                        field: 'info'
                    });
                }
            });
        }

        // 4. Potential Activities
        if (potentialActivities) {
            results.potentialActivities.total = potentialActivities.length;
            potentialActivities.forEach(item => {
                const name = `${item.nome || ''} ${item.cognome || ''}`.trim() || item.id;
                
                if (!item.agente_id || !agentMap[item.agente_id]) {
                    results.potentialActivities.stats.missingAgent++;
                    results.potentialActivities.issues.push({
                        id: item.id,
                        identifier: name,
                        type: 'error',
                        message: 'Agente non assegnato o ID non valido.',
                        field: 'agente_id'
                    });
                }
                if (!item.type) {
                    results.potentialActivities.stats.missingType++;
                    results.potentialActivities.issues.push({
                        id: item.id,
                        identifier: name,
                        type: 'error',
                        message: 'Campo "type" mancante o nullo.',
                        field: 'type'
                    });
                } else if (!['acquirente', 'venditore'].includes(item.type.toLowerCase())) {
                    results.potentialActivities.stats.invalidType++;
                    results.potentialActivities.issues.push({
                        id: item.id,
                        identifier: name,
                        type: 'error',
                        message: `Valore "type" non standard ('${item.type}'). Deve essere 'acquirente' o 'venditore'.`,
                        field: 'type'
                    });
                }
                if (!item.lat || !item.lng) {
                    results.potentialActivities.stats.missingCoords++;
                    results.potentialActivities.issues.push({
                        id: item.id,
                        identifier: name,
                        type: 'warning',
                        message: 'Coordinate geografiche mancanti.',
                        field: 'coordinate'
                    });
                }
            });
        }

        // 5. Telemarketing
        if (telemarketing) {
            results.telemarketing.total = telemarketing.length;
            telemarketing.forEach(item => {
                const identifier = item.nome_azienda || `${item.nome || ''} ${item.cognome || ''}`.trim() || item.id;
                
                if (item.agente_id && !agentMap[item.agente_id]) {
                    results.telemarketing.stats.missingAgent++;
                    results.telemarketing.issues.push({
                        id: item.id,
                        identifier,
                        type: 'warning',
                        message: 'Assegnato ad agente ID non valido (Agente eliminato?).',
                        field: 'agente_id'
                    });
                }
                if (!item.telefono || !item.nome_azienda) {
                    results.telemarketing.stats.missingBasicInfo++;
                    results.telemarketing.issues.push({
                        id: item.id,
                        identifier,
                        type: 'warning',
                        message: 'Telefono o Nome Azienda mancanti.',
                        field: 'info'
                    });
                }
            });
        }

        // 6. Appointments
        if (appointments) {
            results.appointments.total = appointments.length;
            appointments.forEach(item => {
                const identifier = item.titolo || `App. ${item.data_ora || ''}`;
                
                if (!item.agente_id || !agentMap[item.agente_id]) {
                    results.appointments.stats.missingAgent++;
                    results.appointments.issues.push({
                        id: item.id,
                        identifier,
                        type: 'error',
                        message: 'Agente non assegnato.',
                        field: 'agente_id'
                    });
                }
            });
        }

        setScanning(false);
        return results;
    }, [activities, properties, potentialTobacconists, potentialActivities, telemarketing, appointments, agentMap]);

    const totalIssuesCount = useMemo(() => {
        return Object.values(diagnostics).reduce((sum, current) => sum + current.issues.length, 0);
    }, [diagnostics]);

    const handleRunScan = async () => {
        await fetchAllData();
        await fetchEdgeStats();
        toast({ title: "Scansione Database", description: "Scansione di integrità client completata." });
    };

    const renderIssuesTable = (issuesList) => {
        if (issuesList.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-green-50 border border-green-200 rounded-lg text-center mt-4">
                    <CheckCircle className="h-10 w-10 text-green-600 mb-2" />
                    <h3 className="font-semibold text-green-800">Tutti i record sono validi</h3>
                    <p className="text-sm text-green-700">Nessuna anomalia o dato mancante rilevato in questa tabella.</p>
                </div>
            );
        }

        return (
            <div className="border rounded-lg overflow-hidden mt-4 bg-white">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-1/4">Identificativo Record</TableHead>
                            <TableHead className="w-1/6">Stato</TableHead>
                            <TableHead className="w-1/6">Campo Affetto</TableHead>
                            <TableHead>Descrizione Anomalia</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {issuesList.map((issue, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50">
                                <TableCell className="font-medium text-slate-800 font-mono text-xs">{issue.identifier}</TableCell>
                                <TableCell>
                                    <Badge variant={issue.type === 'error' ? 'destructive' : 'warning'}>
                                        {issue.type === 'error' ? 'Errore' : 'Avviso'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs text-slate-600">{issue.field}</TableCell>
                                <TableCell className="text-slate-600 text-sm">{issue.message}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <Card className="border-slate-200">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 bg-slate-50 gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-purple-600" />
                        Diagnostica Integrità Dati
                    </CardTitle>
                    <CardDescription>
                        Analisi strutturale e di coerenza dei dati presenti in memoria per tutte le tabelle operative.
                    </CardDescription>
                </div>
                <Button onClick={handleRunScan} disabled={scanning} size="sm" className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
                    Scansiona Database
                </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                
                {/* Global Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-50 rounded border text-center">
                        <div className="text-2xl font-bold">{agents?.length || 0}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Agenti Registrati</div>
                    </div>
                    <div className="p-4 bg-red-50 rounded border border-red-100 text-center">
                        <div className="text-2xl font-bold text-red-700">
                            {Object.values(diagnostics).reduce((sum, item) => sum + item.issues.filter(i => i.type === 'error').length, 0)}
                        </div>
                        <div className="text-xs text-red-600 uppercase tracking-wide">Errori Rilevati</div>
                    </div>
                    <div className="p-4 bg-amber-50 rounded border border-amber-100 text-center">
                        <div className="text-2xl font-bold text-amber-700">
                            {Object.values(diagnostics).reduce((sum, item) => sum + item.issues.filter(i => i.type === 'warning').length, 0)}
                        </div>
                        <div className="text-xs text-amber-600 uppercase tracking-wide font-medium">Avvisi Integrità</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded border border-green-100 text-center">
                        <div className="text-2xl font-bold text-green-700">{totalIssuesCount === 0 ? "100%" : `${Math.max(0, 100 - Math.round((totalIssuesCount / 1000) * 100))}%`}</div>
                        <div className="text-xs text-green-600 uppercase tracking-wide">Indice Salute DB</div>
                    </div>
                </div>

                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-7 gap-1 h-auto bg-slate-100 p-1 rounded-lg">
                        <TabsTrigger value="overview" className="py-2 text-xs">Panoramica</TabsTrigger>
                        <TabsTrigger value="properties" className="py-2 text-xs">Immobili</TabsTrigger>
                        <TabsTrigger value="activities" className="py-2 text-xs">Attività Comm.</TabsTrigger>
                        <TabsTrigger value="potentialTobacconists" className="py-2 text-xs">Pot. Tabaccherie</TabsTrigger>
                        <TabsTrigger value="potentialActivities" className="py-2 text-xs">Pot. Acquirenti/Vend.</TabsTrigger>
                        <TabsTrigger value="telemarketing" className="py-2 text-xs">Telemarketing</TabsTrigger>
                        <TabsTrigger value="appointments" className="py-2 text-xs">Appuntamenti</TabsTrigger>
                    </TabsList>

                    {/* OVERVIEW PANEL */}
                    <TabsContent value="overview" className="space-y-4 mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Properties Diagnostics Card */}
                            <Card className="border hover:shadow-sm transition-all">
                                <CardHeader className="py-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-semibold">Immobili</CardTitle>
                                        <Badge variant={diagnostics.properties.issues.length > 0 ? "warning" : "outline"}>
                                            {diagnostics.properties.issues.length} anomalie
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs text-slate-500 space-y-1 py-2">
                                    <div>Totale record: <strong>{diagnostics.properties.total}</strong></div>
                                    <div className="flex items-center gap-1"><UserX className="h-3.5 w-3.5 text-red-500" /> Senza Agente: {diagnostics.properties.stats.missingAgent}</div>
                                    <div className="flex items-center gap-1"><MapPinOff className="h-3.5 w-3.5 text-amber-500" /> Senza Coordinate: {diagnostics.properties.stats.missingCoords}</div>
                                    <div className="flex items-center gap-1"><FileWarning className="h-3.5 w-3.5 text-amber-500" /> Indirizzo/Città mancante: {diagnostics.properties.stats.missingBasicInfo}</div>
                                    <Button variant="ghost" size="sm" className="w-full text-xs text-purple-600 mt-2 hover:bg-purple-50 h-8" onClick={() => setSelectedTab('properties')}>Vedi Anomalie &rarr;</Button>
                                </CardContent>
                            </Card>

                            {/* Commercial Activities Diagnostics Card */}
                            <Card className="border hover:shadow-sm transition-all">
                                <CardHeader className="py-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-semibold">Attività Commerciali</CardTitle>
                                        <Badge variant={diagnostics.activities.issues.length > 0 ? "warning" : "outline"}>
                                            {diagnostics.activities.issues.length} anomalie
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs text-slate-500 space-y-1 py-2">
                                    <div>Totale record: <strong>{diagnostics.activities.total}</strong></div>
                                    <div className="flex items-center gap-1"><UserX className="h-3.5 w-3.5 text-red-500" /> Senza Agente: {diagnostics.activities.stats.missingAgent}</div>
                                    <div className="flex items-center gap-1"><MapPinOff className="h-3.5 w-3.5 text-amber-500" /> Senza Coordinate: {diagnostics.activities.stats.missingCoords}</div>
                                    <div className="flex items-center gap-1"><FileWarning className="h-3.5 w-3.5 text-amber-500" /> Info base mancanti: {diagnostics.activities.stats.missingBasicInfo}</div>
                                    <Button variant="ghost" size="sm" className="w-full text-xs text-purple-600 mt-2 hover:bg-purple-50 h-8" onClick={() => setSelectedTab('activities')}>Vedi Anomalie &rarr;</Button>
                                </CardContent>
                            </Card>

                            {/* Potential Tobacconists Diagnostics Card */}
                            <Card className="border hover:shadow-sm transition-all">
                                <CardHeader className="py-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-semibold">Potenziali Tabaccherie</CardTitle>
                                        <Badge variant={diagnostics.potentialTobacconists.issues.length > 0 ? "warning" : "outline"}>
                                            {diagnostics.potentialTobacconists.issues.length} anomalie
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs text-slate-500 space-y-1 py-2">
                                    <div>Totale record: <strong>{diagnostics.potentialTobacconists.total}</strong></div>
                                    <div className="flex items-center gap-1"><UserX className="h-3.5 w-3.5 text-red-500" /> Senza Agente: {diagnostics.potentialTobacconists.stats.missingAgent}</div>
                                    <div className="flex items-center gap-1"><MapPinOff className="h-3.5 w-3.5 text-amber-500" /> Senza Coordinate: {diagnostics.potentialTobacconists.stats.missingCoords}</div>
                                    <div className="flex items-center gap-1"><FileWarning className="h-3.5 w-3.5 text-amber-500" /> Rivendita/Città mancante: {diagnostics.potentialTobacconists.stats.missingBasicInfo}</div>
                                    <Button variant="ghost" size="sm" className="w-full text-xs text-purple-600 mt-2 hover:bg-purple-50 h-8" onClick={() => setSelectedTab('potentialTobacconists')}>Vedi Anomalie &rarr;</Button>
                                </CardContent>
                            </Card>

                            {/* Potential Activities Diagnostics Card */}
                            <Card className="border hover:shadow-sm transition-all">
                                <CardHeader className="py-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-semibold">Potenziali Acquirenti/Venditori</CardTitle>
                                        <Badge variant={diagnostics.potentialActivities.issues.length > 0 ? "warning" : "outline"}>
                                            {diagnostics.potentialActivities.issues.length} anomalie
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs text-slate-500 space-y-1 py-2">
                                    <div>Totale record: <strong>{diagnostics.potentialActivities.total}</strong></div>
                                    <div className="flex items-center gap-1"><UserX className="h-3.5 w-3.5 text-red-500" /> Senza Agente: {diagnostics.potentialActivities.stats.missingAgent}</div>
                                    <div className="flex items-center gap-1"><FileWarning className="h-3.5 w-3.5 text-red-500" /> Tipo Nullo: {diagnostics.potentialActivities.stats.missingType}</div>
                                    <div className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Tipo Invalido (Non standard): {diagnostics.potentialActivities.stats.invalidType}</div>
                                    <Button variant="ghost" size="sm" className="w-full text-xs text-purple-600 mt-2 hover:bg-purple-50 h-8" onClick={() => setSelectedTab('potentialActivities')}>Vedi Anomalie &rarr;</Button>
                                </CardContent>
                            </Card>

                            {/* Telemarketing Diagnostics Card */}
                            <Card className="border hover:shadow-sm transition-all">
                                <CardHeader className="py-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-semibold">Telemarketing</CardTitle>
                                        <Badge variant={diagnostics.telemarketing.issues.length > 0 ? "warning" : "outline"}>
                                            {diagnostics.telemarketing.issues.length} anomalie
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs text-slate-500 space-y-1 py-2">
                                    <div>Totale record: <strong>{diagnostics.telemarketing.total}</strong></div>
                                    <div className="flex items-center gap-1"><UserX className="h-3.5 w-3.5 text-amber-500" /> Agente Riferimento Orfano: {diagnostics.telemarketing.stats.missingAgent}</div>
                                    <div className="flex items-center gap-1"><FileWarning className="h-3.5 w-3.5 text-amber-500" /> Nome azienda o Tel. mancanti: {diagnostics.telemarketing.stats.missingBasicInfo}</div>
                                    <Button variant="ghost" size="sm" className="w-full text-xs text-purple-600 mt-2 hover:bg-purple-50 h-8" onClick={() => setSelectedTab('telemarketing')}>Vedi Anomalie &rarr;</Button>
                                </CardContent>
                            </Card>

                            {/* Appointments Diagnostics Card */}
                            <Card className="border hover:shadow-sm transition-all">
                                <CardHeader className="py-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-semibold">Appuntamenti</CardTitle>
                                        <Badge variant={diagnostics.appointments.issues.length > 0 ? "warning" : "outline"}>
                                            {diagnostics.appointments.issues.length} anomalie
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs text-slate-500 space-y-1 py-2">
                                    <div>Totale record: <strong>{diagnostics.appointments.total}</strong></div>
                                    <div className="flex items-center gap-1"><UserX className="h-3.5 w-3.5 text-red-500" /> Senza Agente: {diagnostics.appointments.stats.missingAgent}</div>
                                    <Button variant="ghost" size="sm" className="w-full text-xs text-purple-600 mt-2 hover:bg-purple-50 h-8" onClick={() => setSelectedTab('appointments')}>Vedi Anomalie &rarr;</Button>
                                </CardContent>
                            </Card>

                        </div>
                    </TabsContent>

                    {/* PROPERTIES PANEL */}
                    <TabsContent value="properties" className="mt-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-medium">Anomalie Tabella Immobili (`properties`)</h3>
                            <Badge variant="secondary">{diagnostics.properties.issues.length} segnalazioni</Badge>
                        </div>
                        {renderIssuesTable(diagnostics.properties.issues)}
                    </TabsContent>

                    {/* COMMERCIAL ACTIVITIES PANEL */}
                    <TabsContent value="activities" className="mt-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-medium">Anomalie Tabella Attività Commerciali (`commercial_activities`)</h3>
                            <Badge variant="secondary">{diagnostics.activities.issues.length} segnalazioni</Badge>
                        </div>
                        {renderIssuesTable(diagnostics.activities.issues)}
                    </TabsContent>

                    {/* POTENTIAL TOBACCONISTS PANEL */}
                    <TabsContent value="potentialTobacconists" className="mt-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-medium">Anomalie Tabella Potenziali Tabaccherie (`potential_tobacconists`)</h3>
                            <Badge variant="secondary">{diagnostics.potentialTobacconists.issues.length} segnalazioni</Badge>
                        </div>
                        {renderIssuesTable(diagnostics.potentialTobacconists.issues)}
                    </TabsContent>

                    {/* POTENTIAL ACTIVITIES PANEL */}
                    <TabsContent value="potentialActivities" className="mt-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-medium">Anomalie Tabella Potenziali Acquirenti/Venditori (`potential_activities`)</h3>
                            <Badge variant="secondary">{diagnostics.potentialActivities.issues.length} segnalazioni</Badge>
                        </div>

                        {/* Remoting Diagnostics & Edge Function Controls */}
                        <div className="bg-slate-50 p-4 border rounded-lg space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Strumenti di Ripristino Remoti (Edge Function)</h4>
                            <p className="text-xs text-slate-600">
                                È presente un'Edge Function remota su Supabase per validare e correggere i tipi anomali ('buyer', 'seller', 'venditore_seller') standardizzandoli in 'acquirente' o 'venditore'.
                            </p>
                            
                            {edgeStats ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div className="p-2 border bg-white rounded text-center">
                                        <div className="font-semibold text-slate-700">{edgeStats.total}</div>
                                        <div className="text-slate-500">Record Totali</div>
                                    </div>
                                    <div className="p-2 border bg-red-50 rounded text-center border-red-100">
                                        <div className="font-semibold text-red-700">{edgeStats.nullOrEmpty}</div>
                                        <div className="text-red-500">Tipi NULL/Vuoti</div>
                                    </div>
                                    <div className="p-2 border bg-white rounded text-center col-span-2">
                                        <div className="text-slate-500">
                                            Ripartizione: <strong>Acquirenti:</strong> {edgeStats.breakdown.find(x => x.type === 'acquirente')?.count || 0} | <strong>Venditori:</strong> {edgeStats.breakdown.find(x => x.type === 'venditore')?.count || 0}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 italic">Verifica statistiche Edge in corso...</div>
                            )}

                            <div className="flex gap-2">
                                <Button 
                                    onClick={fetchEdgeStats} 
                                    disabled={loadingEdge || fixingEdge} 
                                    variant="outline" 
                                    size="sm"
                                >
                                    {loadingEdge ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                    Scansiona Remoto
                                </Button>
                                {(edgeStats?.nullOrEmpty > 0 || edgeStats?.breakdown.some(b => !['acquirente', 'venditore'].includes(b.type))) && (
                                    <Button 
                                        onClick={fixPotentialActivitiesEdge} 
                                        disabled={fixingEdge || loadingEdge} 
                                        variant="destructive" 
                                        size="sm"
                                        className="gap-2"
                                    >
                                        {fixingEdge ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                                        Esegui correzione tipi nel DB
                                    </Button>
                                )}
                            </div>
                        </div>

                        {renderIssuesTable(diagnostics.potentialActivities.issues)}
                    </TabsContent>

                    {/* TELEMARKETING PANEL */}
                    <TabsContent value="telemarketing" className="mt-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-medium">Anomalie Tabella Telemarketing (`telemarketing_contacts`)</h3>
                            <Badge variant="secondary">{diagnostics.telemarketing.issues.length} segnalazioni</Badge>
                        </div>
                        {renderIssuesTable(diagnostics.telemarketing.issues)}
                    </TabsContent>

                    {/* APPOINTMENTS PANEL */}
                    <TabsContent value="appointments" className="mt-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-medium">Anomalie Tabella Appuntamenti (`appointments`)</h3>
                            <Badge variant="secondary">{diagnostics.appointments.issues.length} segnalazioni</Badge>
                        </div>
                        {renderIssuesTable(diagnostics.appointments.issues)}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default TablesDiagnosticPanel;
