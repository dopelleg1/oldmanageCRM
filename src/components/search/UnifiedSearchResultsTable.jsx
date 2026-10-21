import React, { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

const UnifiedSearchResultsTable = ({ results, onRowClick }) => {
  const columns = useMemo(() => [
    {
      accessorKey: 'typeName',
      header: 'Tipo',
      cell: ({ row }) => {
        const typeName = row.getValue('typeName');
        let badgeVariant = 'secondary';
        
        if (typeName === 'Immobile') badgeVariant = 'default';
        else if (typeName === 'Attività Commerciale') badgeVariant = 'outline';
        else if (typeName === 'Potenziale Tabaccheria') badgeVariant = 'secondary';
        else if (typeName === 'Potenziale Acquirente/Venditore') badgeVariant = 'destructive';
        
        return (
          <Badge variant={badgeVariant} className="whitespace-nowrap font-semibold">
            {typeName}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'identifier',
      header: 'Identificativo',
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {row.getValue('identifier')}
        </span>
      )
    },
    {
      accessorKey: 'title',
      header: 'Nome/Titolo',
      cell: ({ row }) => (
        <span className="font-medium truncate max-w-[200px] block" title={row.getValue('title')}>
          {row.getValue('title')}
        </span>
      )
    },
    {
      accessorKey: 'subtitle',
      header: 'Dettagli/Contatti',
      cell: ({ row }) => (
        <span className="text-slate-500 dark:text-slate-400 text-sm truncate max-w-[300px] block" title={row.getValue('subtitle')}>
          {row.getValue('subtitle')}
        </span>
      )
    },
    {
      accessorKey: 'agentName',
      header: 'Agente',
      cell: ({ row }) => (
        <span className="text-slate-600 dark:text-slate-300 font-medium">
          {row.getValue('agentName')}
        </span>
      )
    },
    {
      accessorKey: 'createdAt',
      header: 'Data Creazione',
      cell: ({ row }) => {
        const dateVal = row.getValue('createdAt');
        try {
          return new Date(dateVal).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {
          return 'N/A';
        }
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRowClick(row.original.originalRecord)}
          className="h-8 text-xs flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ExternalLink className="h-3 w-3" />
          Apri
        </Button>
      )
    }
  ], [onRowClick]);

  return (
    <div className="space-y-4 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Risultati della Ricerca Globale ({results.length})
        </h3>
      </div>
      <DataTable
        columns={columns}
        data={results}
      />
    </div>
  );
};

export default UnifiedSearchResultsTable;
