import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import type { Creditor } from "@/types";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  data: Creditor[];
  companySlug?: string;
};

function StatusBadgeInline({ status, elegivel }: { status: Creditor["status"]; elegivel: boolean }) {
  if (!elegivel) {
    return <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Não elegível</span>;
  }
  if (status === "qualificado") {
    return <span className="inline-flex items-center rounded-md border border-green-200 bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-800">Qualificado</span>;
  }
  if (status === "marginal") {
    return <span className="inline-flex items-center rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">Marginal</span>;
  }
  return <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Rejeitado</span>;
}

export function CreditorsTable({ data, companySlug }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [minValor, setMinValor] = useState("");
  const [maxValor, setMaxValor] = useState("");
  const min = parseMoneyInput(minValor);
  const max = parseMoneyInput(maxValor);

  const dataForTable = useMemo(
    () =>
      data
        .filter((row) => (min === null ? true : row.valor >= min))
        .filter((row) => (max === null ? true : row.valor <= max))
        .filter((row) => {
          if (statusFilter === "all") return true;
          if (statusFilter === "elegivel") return row.elegivel;
          return row.status === statusFilter;
        }),
    [data, min, max, statusFilter],
  );

  const columns = useMemo<ColumnDef<Creditor>[]>(
    () => [
      {
        accessorKey: "nome",
        header: "Credor",
        cell: ({ row }) => (
          <Link
            to={`/credor/rj/${row.original.rowHash}`}
            state={companySlug ? { backTo: `/empresa/${companySlug}`, backLabel: "Voltar para a empresa" } : undefined}
            className="font-medium text-primary hover:underline"
          >
            {row.original.nome}
          </Link>
        ),
      },
      {
        accessorKey: "cpfCnpj",
        header: "CPF/CNPJ",
      },
      {
        accessorKey: "classe",
        header: "Classe",
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue) return true;
          return String(row.getValue(columnId)) === String(filterValue);
        },
      },
      {
        accessorKey: "valor",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-8 px-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Valor
            <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => brl(row.original.valor),
      },
      {
        accessorKey: "score",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-8 px-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Score
            <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const score = row.original.score;
          const color =
            score >= 65 ? "text-primary font-semibold" :
            score >= 50 ? "text-warning font-semibold" :
            "text-muted-foreground";
          return <span className={color}>{score || "—"}</span>;
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadgeInline status={row.original.status} elegivel={row.original.elegivel} />
        ),
      },
      {
        accessorKey: "desagioRec",
        header: "Deságio rec.",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.desagioRec}</span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: dataForTable,
    columns,
    state: { sorting, globalFilter, columnFilters },
    initialState: {
      pagination: { pageSize: 25 },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      if (!search) return true;
      return [
        row.original.nome,
        row.original.cpfCnpj,
        row.original.classe,
        row.original.tipoPessoa,
        row.original.telefones.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    },
  });

  const classeFilter = (table.getColumn("classe")?.getFilterValue() as string) ?? "all";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        <Input
          placeholder="Buscar por nome ou CPF/CNPJ"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="md:col-span-2"
        />
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="elegivel">Elegíveis</SelectItem>
            <SelectItem value="qualificado">Qualificados (≥ 65)</SelectItem>
            <SelectItem value="marginal">Marginais (50–64)</SelectItem>
            <SelectItem value="rejeitado">Rejeitados (&lt; 50)</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={classeFilter}
          onValueChange={(value) => table.getColumn("classe")?.setFilterValue(value === "all" ? undefined : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Classe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as classes</SelectItem>
            <SelectItem value="I">Classe I</SelectItem>
            <SelectItem value="II">Classe II</SelectItem>
            <SelectItem value="III">Classe III</SelectItem>
            <SelectItem value="IV">Classe IV</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Mín R$" value={minValor} onChange={(event) => setMinValor(event.target.value)} />
          <Input placeholder="Máx R$" value={maxValor} onChange={(event) => setMaxValor(event.target.value)} />
        </div>
      </div>

      <div className="h-[68vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhum credor encontrado para os filtros selecionados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} registro(s) após filtros •{" "}
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

function parseMoneyInput(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
