import { useEffect, useMemo, useState } from "react";
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
import { ArrowUpDown, Banknote, CheckCircle2, CircleDollarSign, Hash, Phone, ShieldCheck, Tag, TrendingUp, User } from "lucide-react";
import type { Creditor } from "@/types";
import { brl, documentId } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 px-1.5 py-0.5 text-[11px] font-medium text-primary">
        <CheckCircle2 className="size-3" />
        Qualificado
      </span>
    );
  }
  if (status === "marginal") {
    return <span className="inline-flex items-center rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">Marginal</span>;
  }
  return <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Rejeitado</span>;
}

function ScoreDonut({ score }: { score: number }) {
  const safe = Math.max(0, Math.min(100, score || 0));
  const radius = 13;
  const circumference = 2 * Math.PI * radius;
  const color = score >= 65 ? "text-primary" : score >= 50 ? "text-warning" : "text-muted-foreground";

  return (
    <div className={`relative size-9 ${color}`} aria-label={`Score ${score || 0} de 100`}>
      <svg className="size-9 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - safe / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-none tabular-nums text-foreground">
        {score || "—"}
      </span>
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

export function CreditorsTable({ data, companySlug }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "score", desc: true },
    { id: "valor", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [minValorInput, setMinValorInput] = useState("");
  const [maxValorInput, setMaxValorInput] = useState("");
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMin(parseMoneyInput(minValorInput));
      setMax(parseMoneyInput(maxValorInput));
    }, 400);
    return () => clearTimeout(timeout);
  }, [minValorInput, maxValorInput]);

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
        header: () => <span className="inline-flex items-center gap-1"><User className="size-3.5" />Credor</span>,
        cell: ({ row }) => (
          <Link
            to={`/credor/rj/${row.original.rowHash}`}
            state={companySlug ? { backTo: `/empresa/${companySlug}`, backLabel: "Voltar para a empresa" } : undefined}
            className="font-semibold text-primary hover:underline"
          >
            {row.original.nome}
          </Link>
        ),
      },
      {
        id: "hasTelefone",
        accessorFn: (row) => (row.hasTelefone ? 1 : 0),
        header: ({ column }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="-ml-3 h-8 px-3"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              >
                <Phone className="size-3.5" />
                Tel.
                <ArrowUpDown className="ml-1 size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Telefone cadastrado</TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex justify-center">
                <Phone className={`size-3.5 ${row.original.hasTelefone ? "text-primary" : "text-muted-foreground/30"}`} />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {row.original.hasTelefone ? "Tem telefone cadastrado" : "Sem telefone cadastrado"}
            </TooltipContent>
          </Tooltip>
        ),
        size: 40,
      },
      {
        id: "rendaMensalEstimada",
        accessorFn: (row) => row.rendaMensalEstimada ?? -1,
        header: ({ column }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="-ml-3 h-8 px-3"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              >
                <Banknote className="size-3.5" />
                Renda/mês
                <ArrowUpDown className="ml-1 size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Renda mensal estimada</TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const renda = row.original.rendaMensalEstimada;
          return renda != null ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs tabular-nums text-muted-foreground">~{brl(renda)}</span>
              </TooltipTrigger>
              <TooltipContent>Renda mensal estimada</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-muted-foreground/30">—</span>
          );
        },
        size: 100,
      },
      {
        accessorKey: "cpfCnpj",
        header: () => <span className="inline-flex items-center gap-1"><Hash className="size-3.5" />CPF/CNPJ</span>,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {documentId(row.original.cpfCnpj)}
          </span>
        ),
      },
      {
        accessorKey: "classe",
        header: () => <span className="inline-flex items-center gap-1"><Tag className="size-3.5" />Classe</span>,
        cell: ({ row }) => {
          const classe = row.original.classe;
          return classe === "I" ? "Trabalhista" : `Classe ${classe}`;
        },
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
            <CircleDollarSign className="size-3.5" />
            Valor
            <ArrowUpDown className="ml-1 size-3" />
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
            <TrendingUp className="size-3.5" />
            Score
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ row }) => {
          return <ScoreDonut score={row.original.score} />;
        },
      },
      {
        accessorKey: "status",
        header: () => <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" />Status</span>,
        cell: ({ row }) => (
          <StatusBadgeInline status={row.original.status} elegivel={row.original.elegivel} />
        ),
      },
    ],
    [companySlug],
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
            <SelectItem value="I">Trabalhista</SelectItem>
            <SelectItem value="II">Classe II</SelectItem>
            <SelectItem value="III">Classe III</SelectItem>
            <SelectItem value="IV">Classe IV</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Mín R$"
            value={minValorInput}
            onChange={(e) => setMinValorInput(e.target.value.replace(/[^\d.,]/g, ""))}
          />
          <Input
            placeholder="Máx R$"
            value={maxValorInput}
            onChange={(e) => setMaxValorInput(e.target.value.replace(/[^\d.,]/g, ""))}
          />
        </div>
      </div>

      <div className="h-[68vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.id === "nome" ? "pl-5" : header.column.id === "status" ? "pr-5" : undefined}
                  >
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
                    <TableCell
                      key={cell.id}
                      className={cell.column.id === "nome" ? "pl-5" : cell.column.id === "status" ? "pr-5" : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getAllLeafColumns().length} className="h-24 text-center text-muted-foreground">
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
