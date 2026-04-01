import { useRef, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Phone } from "lucide-react";
import { brl } from "@/lib/format";
import type { CredorPrecatorio } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  credores: CredorPrecatorio[];
  devedorSlug: string;
};

type HeaderNavState = {
  backTo?: string;
  backLabel?: string;
  processBackTo?: string;
  processBackLabel?: string;
};

const ESTIMATED_ROW_HEIGHT = 48;

function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return raw;
}

function whatsappUrl(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
}

export function CredoresPrecatorioTable({ credores, devedorSlug }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<CredorPrecatorio>[]>(
    () => [
      {
        accessorKey: "credorNome",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting()}>
            Credor
            <ArrowUpDown className="ml-2 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            to={`/credor/precatorio/${encodeURIComponent(row.original.numeroProcesso)}/${encodeURIComponent(row.original.credorNome)}`}
            state={
              {
                backTo: `/processo/${encodeURIComponent(row.original.numeroProcesso)}`,
                backLabel: "Voltar para o processo",
                processBackTo: `/devedor/${devedorSlug}`,
                processBackLabel: "Voltar para o devedor",
              } satisfies HeaderNavState
            }
            className="font-medium text-primary hover:underline"
          >
            {row.original.credorNome}
          </Link>
        ),
      },
      {
        accessorKey: "numeroProcesso",
        header: "Processo",
        cell: ({ row }) => {
          const np = row.original.numeroProcesso;
          return np ? (
            <Link
              to={`/processo/${encodeURIComponent(np)}`}
              state={{ backTo: `/devedor/${devedorSlug}`, backLabel: "Voltar para o devedor" } satisfies HeaderNavState}
              className="font-mono text-xs text-primary underline-offset-2 hover:underline"
            >
              {np}
            </Link>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "natureza",
        header: "Natureza",
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{String(getValue() || "—")}</span>
        ),
      },
      {
        accessorKey: "valor",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting()}>
            Valor
            <ArrowUpDown className="ml-2 size-3.5" />
          </Button>
        ),
        cell: ({ getValue }) => (
          <span className="font-semibold tabular-nums">{brl(getValue() as number)}</span>
        ),
      },
      {
        accessorKey: "suspenso",
        header: "Status",
        size: 90,
        cell: ({ row }) => {
          if (row.original.suspenso) return <Badge variant="destructive" className="text-[11px]">Suspenso</Badge>;
          if (row.original.pagamentoPrioritario) return <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px]">Prioritário</Badge>;
          return <Badge variant="outline" className="text-[11px]">Normal</Badge>;
        },
      },
      {
        accessorKey: "telefones",
        header: "Contato",
        enableSorting: false,
        cell: ({ row }) => {
          const tels = row.original.telefones.slice(0, 2);
          return tels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tels.map((tel) => (
                <a
                  key={tel}
                  href={whatsappUrl(tel)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-800 hover:bg-green-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="size-2.5" />
                  {formatPhone(tel)}
                </a>
              ))}
              {row.original.telefones.length > 2 && (
                <span className="text-[11px] text-muted-foreground">+{row.original.telefones.length - 2}</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: credores,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom = totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0);

  return (
    <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Credores</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {credores.length} credor{credores.length !== 1 ? "es" : ""} mapeado{credores.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Input
            placeholder="Filtrar por nome ou processo..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 w-64 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={parentRef} className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card border-b">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-2 text-left text-xs font-medium text-muted-foreground"
                      style={{ width: header.column.columnDef.size }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && <tr><td style={{ height: paddingTop }} /></tr>}
              {virtualItems.map((vi) => {
                const row = rows[vi.index];
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && <tr><td style={{ height: paddingBottom }} /></tr>}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {globalFilter ? "Nenhum credor encontrado." : "Nenhum credor mapeado para este devedor."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
