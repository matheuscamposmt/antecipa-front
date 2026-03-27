export type ProspectStatus = "qualificado" | "marginal" | "rejeitado";

export type ScoreBreakdown = {
  ativo: { classe: number; documento: number; sinais: number; total: number };
  devedor: { faixa: number; total: number };
  credor: { tipoPessoa: number; valor: number; total: number };
};

export type Overview = {
  loadedAt: string;
  totalEmpresas: number;
  totalEmpresasComCredores: number;
  totalGruposEconomicos: number;
  valorTotalCredito: number;
  mediaValorPorEmpresa: number;
  medianaValorPorEmpresa: number;
  topAdministradoresJudiciais: Array<{ nome: string; empresas: number }>;
  topClasses: Array<{ classe: string; quantidade: number }>;
};

export type PrecatorioOverview = {
  loadedAt: string;
  totalDevedores: number;
  totalComCnpj: number;
  totalPrecatorios: number;
  valorTotalPrecatorio: number;
  valorTotalPago: number;
};

export type Company = {
  id: number;
  slug: string;
  administradorJudicial: string;
  nomeEmpresa: string;
  grupoEconomico: string;
  dataDocumento: string;
  dataHomologacao: string;
  dataReferenciaIso: string;
  linkCredores: string;
  arquivoCredores: string;
  totalCredito: number;
  quantidadeCredores: number;
  quantidadePF: number;
  quantidadePJ: number;
  valorMediano: number;
  scoreMedio: number;
  capitalSocialEstimado: null;
};

export type PrecatorioDebtor = {
  slug: string;
  tribunal: string;
  nomeEmpresa: string;
  cnpj: string;
  regime: string;
  quantidadePrecatorios: number;
  valorTotalPrecatorio: number;
  valorTotalPago: number;
  dataReferencia: string;
  origemUrl: string;
};

export type Creditor = {
  rowHash: string;
  nome: string;
  cpfCnpj: string;
  tipoPessoa: "PF" | "PJ" | "OUTRO";
  classe: string;
  valor: number;
  moeda: string;
  extra: string;
  telefones: string[];
  score: number;
  scoreAtivo: number;
  scoreDevedor: number;
  scoreCredit: number;
  status: ProspectStatus;
  desagioRec: string;
  elegivel: boolean;
  scoreBreakdown: ScoreBreakdown;
};

export type CompanyDetail = {
  company: Company;
  ranking: Creditor[];
  credores: Creditor[];
  distributionByClasse: Array<{ classe: string; total: number; quantidade: number }>;
};

export type CredorRJDetail = {
  rowHash: string;
  nome: string;
  cpfCnpj: string;
  tipoPessoa: "PF" | "PJ" | "OUTRO";
  classe: string;
  valor: number;
  moeda: string;
  extra: string;
  telefones: string[];
  score: number;
  scoreAtivo: number;
  scoreDevedor: number;
  scoreCredit: number;
  status: ProspectStatus;
  desagioRec: string;
  elegivel: boolean;
  scoreBreakdown: ScoreBreakdown;
  empresa: {
    nomeEmpresa: string;
    grupoEconomico: string;
    administradorJudicial: string;
    dataHomologacao: string;
    dataDocumento: string;
    linkCredores: string;
    slug: string;
  };
  outrasEmpresas: Array<{
    nomeEmpresa: string;
    grupoEconomico: string;
    slug: string;
    valor: number;
    classe: string;
    rowHash: string;
  }>;
};

export type DevedorDetail = {
  devedor: PrecatorioDebtor;
  precatorios: Array<{
    ordemCronologica: string;
    numeroPrecatorio: string;
    numeroRp: string;
    naturezaCredito: string;
    pagamentoPreferencial: string;
    vencimento: string;
    dataRecebimento: string;
    dataUltimaAtualizacao: string;
    valorPrecatorio: number;
    valorPagamento: number;
  }>;
  contatosProcesso: {
    credores: Array<{
      nome: string;
      numerosProcesso: string[];
      telefones: string[];
    }>;
    advogados: Array<{
      nome: string;
      numeroOab: string;
      ufOab: string;
      numerosProcesso: string[];
      telefones: string[];
    }>;
  };
};
