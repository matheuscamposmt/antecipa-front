export type ProspectStatus = "qualificado" | "marginal" | "rejeitado";

export type ScoreBreakdown = {
  ativo: { classe: number; documento: number; sinais: number; total: number };
  devedor: { faixa: number; total: number };
  credor: { tipoPessoa: number; valor: number; total: number };
};

export type DetailScoreBreakdown = {
  ativo: {
    total: number;
    method: string;
    note: string;
    items: Array<{ label: string; pts: number; max: number }>;
  };
  devedor: {
    total: number;
    method: string;
    note: string;
    items: Array<{ label: string; pts: number; max: number }>;
  };
  credor: {
    total: number;
    method: string;
    note: string;
    items: Array<{ label: string; pts: number; max: number }>;
  };
};

export type ProspectDetails = {
  rendaAnualEstimada: number | null;
  rendaAnoReferencia: number | null;
  beneficiarioProgramaSocial: boolean | null;
  programaSocialDescricao: string;
  programaSocialAnoReferencia: number | null;
  localizacao: {
    uf: string;
    municipio: string;
    bairro: string;
    cep: string;
    rendaPerCapita: number | null;
  };
  homonimo: {
    risco: "baixo" | "medio" | "alto";
    quantidade: number;
    criterio: string;
    observacao: string;
  };
};

export type ClasseBreakdownItem = {
  classe: string;
  quantidade: number;
  valorTotal: number;
  empresas: number;
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
  topEmpresasPorCredito: Array<{ nome: string; totalCredito: number }>;
  classeBreakdown: ClasseBreakdownItem[];
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
  scoreBreakdown: DetailScoreBreakdown;
  prospectDetails: ProspectDetails;
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

export type CredorPrecatorio = {
  credorNome: string;
  credorDocumento: string;
  numeroProcesso: string;
  numeroPrecatorio: string;
  valor: number;
  natureza: string;
  suspenso: boolean;
  pagamentoPrioritario: boolean;
  telefones: string[];
};

export type CredorPrecatorioScoreBreakdown = {
  ativo: { natureza: number; suspensao: number; prioridade: number; total: number };
  devedor: { regime: number; percentualPago: number; total: number };
  credor: { tipoPessoa: number; valor: number; total: number };
};

export type CredorPrecatorioDetail = {
  credorNome: string;
  credorDocumento: string;
  tipoPessoa: "PF" | "PJ" | "OUTRO";
  valorTotal: number;
  valorPago: number;
  score: number;
  scoreAtivo: number;
  scoreDevedor: number;
  scoreCredit: number;
  status: ProspectStatus;
  desagioRec: string;
  elegivel: boolean;
  scoreBreakdown: DetailScoreBreakdown;
  prospectDetails: ProspectDetails;
  telefones: string[];
  processo: {
    numeroProcesso: string;
    devedor: string;
    cnpj: string;
    tribunal: string;
    regime: string;
    percentualPago: number;
    origemUrl: string;
  };
  precatorios: Array<{
    numeroPrecatorio: string;
    natureza: string;
    pagamentoPrioritario: boolean;
    suspenso: boolean;
    valor: number;
    valorPago: number;
    vencimento: string;
    dataRecebimento: string;
  }>;
  advogados: Array<{
    nome: string;
    numeroOab: string;
    ufOab: string;
    telefones: string[];
  }>;
};

export type AdvogadoDevedorItem = {
  nome: string;
  numeroOab: string;
  ufOab: string;
  telefones: string[];
};

export type DevedorDetail = {
  devedor: PrecatorioDebtor;
  credores: CredorPrecatorio[];
  advogados: AdvogadoDevedorItem[];
  precatorios: Array<{
    ordemCronologica: string;
    numeroPrecatorio: string;
    numeroProcesso: string;
    numeroRp: string;
    naturezaCredito: string;
    pagamentoPreferencial: string;
    vencimento: string;
    dataRecebimento: string;
    dataUltimaAtualizacao: string;
    valorPrecatorio: number;
    valorPagamento: number;
    suspenso: boolean;
  }>;
};

export type ProcessoDetail = {
  numeroProcesso: string;
  devedor: string;
  cnpj: string;
  tribunal: string;
  score: number;
  scoreLabel: string;
  valorTotal: number;
  valorPago: number;
  quantidadePrecatorios: number;
  temPrioritario: boolean;
  algumSuspenso: boolean;
  naturezaDominante: string;
  precatorios: Array<{
    numeroPrecatorio: string;
    natureza: string;
    pagamentoPreferencial: string;
    vencimento: string;
    dataRecebimento: string;
    valorPrecatorio: number;
    valorPagamento: number;
    suspenso: boolean;
  }>;
  credores: Array<{
    nome: string;
    telefones: string[];
  }>;
  advogados: Array<{
    nome: string;
    numeroOab: string;
    ufOab: string;
    telefones: string[];
  }>;
};
