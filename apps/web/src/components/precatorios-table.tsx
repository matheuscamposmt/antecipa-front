import { brl } from "@/lib/format";
import type { DevedorDetail } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  detail: DevedorDetail;
};

export function PrecatoriosTable({ detail }: Props) {
  const rows = detail.precatorios;

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="text-base">Tabela cronológica de precatórios</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem</TableHead>
                <TableHead>Precatório</TableHead>
                <TableHead>RP</TableHead>
                <TableHead>Natureza</TableHead>
                <TableHead>Preferencial</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Recebimento</TableHead>
                <TableHead>Atualização</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.numeroPrecatorio}-${row.ordemCronologica}-${row.numeroRp}`}>
                  <TableCell>{row.ordemCronologica || "-"}</TableCell>
                  <TableCell>{row.numeroPrecatorio || "-"}</TableCell>
                  <TableCell>{row.numeroRp || "-"}</TableCell>
                  <TableCell>{row.naturezaCredito || "-"}</TableCell>
                  <TableCell>{row.pagamentoPreferencial || "-"}</TableCell>
                  <TableCell>{row.vencimento || "-"}</TableCell>
                  <TableCell>{row.dataRecebimento || "-"}</TableCell>
                  <TableCell>{row.dataUltimaAtualizacao || "-"}</TableCell>
                  <TableCell className="text-right">{brl(row.valorPrecatorio)}</TableCell>
                  <TableCell className="text-right">{brl(row.valorPagamento)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
