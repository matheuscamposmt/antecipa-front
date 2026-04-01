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
import { ArrowUpDown } from "lucide-react";
import { brl } from "@/lib/format";
import type { DevedorDetail } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Row = DevedorDetail["precatorios"][number];

type Props = {
  detail: DevedorDetail;
  devedorSlug: string;
};

type HeaderNavState = {
  backTo?: string;
  backLabel?: string;
};

const ESTIMATED_ROW_HEIGHT = 40;

export function PrecatoriosTable({ detail, devedorSlug }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "ordemCronologica",
        header: "#",
        size: 52,
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
            <span className="font-mono text-xs text-muted-foreground">
              {row.original.numeroPrecatorio || "-"}
            </span>
          );
        },
      },
      {
        accessorKey: "naturezaCredito",
        header: "Natureza",
        size: 120,
      },
      {
        accessorKey: "pagamentoPreferencial",
        header: "Preferencial",
        size: 100,
      },
      {
        accessorKey: "suspenso",
        header: "Suspenso",
        size: 90,
        cell: ({ row }) =>
          row.original.suspenso ? (
            <Badge variant="destructive" className="text-xs opacity-80">
              Sim
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Não</span>
          ),
      },
      {
        accessorKey: "vencimento",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-7 px-3 text-xs font-medium text-muted-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Vencimento
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        size: 130,
      },
      {
        accessorKey: "dataRecebimento",
        header: "Recebimento",
        size: 120,
      },
      {
        accessorKey: "dataUltimaAtualizacao",
        header: "Atualização",
        size: 110,
      },
      {
        accessorKey: "valorPrecatorio",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-7 px-3 text-xs font-medium text-muted-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Valor
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{brl(row.original.valorPrecatorio)}</span>
        ),
        size: 140,
      },
      {
        accessorKey: "valorPagamento",
        header: "Pago",
        cell: ({ row }) => (
          <span className="tabular-nums">{brl(row.original.valorPagamento)}</span>
        ),
        size: 130,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: detail.precatorios,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _colId, filterValue) => {
      const q = String(filterValue).toLowerCase();
      if (!q) return true;
      return [
        row.original.numeroProcesso,
        row.original.numeroPrecatorio,
        row.original.naturezaCredito,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    },
  });

  const rows = table.getRowModel().rows;
  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalVirtualSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalVirtualSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  const total = detail.precatorios.length;
  const filtered = rows.length;

  return (
    <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Tabela cronológica de precatórios</CardTitle>
          <span className="text-xs text-muted-foreground">
            {filtered === total
              ? `${total.toLocaleString("pt-BR")} registro${total !== 1 ? "s" : ""}`
              : `${filtered.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} registro${total !== 1 ? "s" : ""}`}
          </span>
        </div>
        <Input
          placeholder="Filtrar por processo ou natureza…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="h-8 max-w-xs text-sm"
        />
      </CardHeader>
      <CardContent className="p-0">
        {/* Scrollable container — virtualizer uses this as scroll element */}
        <div ref={containerRef} className="max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b bg-background">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="whitespace-nowrap px-4 py-2 text-left text-xs font-medium text-muted-foreground"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {/* Top spacer — keeps scroll thumb proportional */}
              {paddingTop > 0 && (
                <tr aria-hidden>
                  <td style={{ height: paddingTop }} />
                </tr>
              )}

              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 hover:bg-muted/30"
                    style={{ height: ESTIMATED_ROW_HEIGHT }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {/* Bottom spacer */}
              {paddingBottom > 0 && (
                <tr aria-hidden>
                  <td style={{ height: paddingBottom }} />
                </tr>
              )}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Nenhum resultado para "{globalFilter}".
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
