/** Types of the normalised JSON written by scripts/build_data.py. */

export interface Flag {
  id: string;
  meaning: string;
  step: string;
}

export interface AtlasMitigationRef {
  id?: string;
  name?: string;
  concreteness?: string;
  partial?: boolean;
  raw?: string;
}

export interface EtsiRef {
  provision?: string;
  verb?: 'shall' | 'should';
  concreteness?: string;
  principle?: string;
  raw?: string;
}

export interface IsoRef {
  id?: string;
  name?: string;
  raw?: string;
}

export interface LegalRef {
  citation?: string;
  condition?: string;
  /** As in the catalogue, e.g. "Abstract" or "Abstract*" (* = proposed classification). */
  concreteness?: string;
  key?: string | null;
  raw?: string;
}

export interface Control {
  id: string;
  family: string;
  name: string;
  what: string;
  evidence: string;
  phases: string[];
  type: string;
  appliesWhen: string;
  condition: string;
  crossCutting: boolean;
  atlasLinks: string[];
  proposedLinks: string[];
  atlasMitigations: AtlasMitigationRef[];
  etsi: EtsiRef[];
  iso: IsoRef[];
  legal: LegalRef[];
  nature: string[];
  concreteness: string | null;
  noSourceWhy: string | null;
  status: string;
}

export interface JnicContent {
  names: string[];
  description: string | null;
  /** AI Act text of the curated matrix (cross-references resolved); null when the matrix has none. */
  coverage: string | null;
  whyAiAct: string | null;
  link: string | null;
}

export interface Technique {
  id: string;
  nameMatrix: string;
  nameAtlas: string | null;
  tactics: string[];
  phases: string[];
  phasesCatalogue: string[];
  inAtlas: boolean;
  atlasMitigations: string[];
  matrixMitigationStatus: string | null;
  controlsAtlas: string[];
  controlsProposed: string[];
  nist: string[];
  attackerPreparation: boolean;
  appliesWhen: string;
  /** Catalogue value replaced by a proposed refinement (data/authored/applicability_refinements.json). */
  appliesWhenCatalogue?: string;
  notes: string[];
  jnic: JnicContent;
}

export interface LegalBasis {
  key: string;
  citation: string;
  condition: string;
  rule: string;
  concreteness: string;
  concretenessOrigin: string;
  controls: string[];
}

export interface PhaseInfo {
  id: string;
  definition: string | null;
}

export interface CatalogueMeta {
  buildDate: string;
  phases: PhaseInfo[];
  catalogue: { file: string; title: string; version: string };
  jnic: { file: string; title: string };
  sources: string[];
  etsiLink: string | null;
}

export interface Catalogue {
  meta: CatalogueMeta;
  flags: Flag[];
  controls: Control[];
  techniques: Technique[];
  legalBasis: LegalBasis[];
}

export interface Obligation {
  id: string;
  row: number;
  section: string;
  obligation: string;
  article: string;
  concreteness: string | null;
  classRaw: string | null;
  preconditions: string | null;
  rule: string;
  ruleStatus: string;
  translationStatus: string;
}

export interface PurposeVariable {
  id: string;
  meaning: string;
}

export interface AiActData {
  premise: { row: number; text: string | null }[];
  riskTable: { row: number; risk: string; description: string; whyMinimalRiskIsExposed: string }[];
  obligations: Obligation[];
  purposeVocabulary: PurposeVariable[];
  gapsTitle: string;
  gaps: { article: string | null; description: string | null; reason: string | null; papers: string[] }[];
  papers: { reference: string; abstract: string | null }[];
  etsi: { area: string | null; establishes: string | null; gaps: string | null }[];
}

export interface AtlasData {
  mitigations: {
    id: string;
    name: string;
    category: string;
    phases: string[];
    concreteness: string;
    techniques: string[];
    controls: string[];
  }[];
  outside: {
    id: string;
    name: string;
    tactics: string[];
    maturity: string;
    mitigations: string[];
    controlsAtlas: string[];
    controlsProposed: string[];
  }[];
}

export interface CatalogueDocs {
  readme: { title: string; version: string; sections: { title: string; lines: string[] }[] };
  summary: {
    families: { family: string; controls: number; withAtlasLink: number }[];
    figures: { label: string; value: number }[];
  };
}

/** One row of the curated JNIC matrix (src/data/jnic-matrix.json). */
export interface JnicMatrixRow {
  phase: string;
  id: string;
  name: string;
  inAtlas: boolean;
  successor: string | null;
  tactics: string[];
  attackerPreparation: boolean;
  appliesWhen: string;
  appliesWhenCatalogue: string | null;
  description: string | null;
  aiAct: {
    text: string | null;
    origin: 'matrix' | 'crossReference' | 'sameTechnique' | 'noProvision' | 'none';
    from: { id: string; phase: string; name: string } | null;
  };
  whyAiAct: string | null;
  softLaw: string | null;
  nistRmf: { sections: string[]; text: string | null };
  whyNist: string | null;
  nist600: { actions: string[]; note: string | null; origin: 'matrix' | 'catalogue' | 'none' };
  mitigations: { id: string; name: string | null }[];
  matrixProposal: string | null;
  controls: { id: string; name: string; link: 'atlas' | 'proposed' }[];
  legalViaControls: { citation: string; condition: string; controls: string[] }[];
  /** Cells filled from the same technique's row in another phase (field -> that phase). */
  filledFrom: Partial<Record<'description' | 'softLaw' | 'nistRmf' | 'whyNist' | 'nist600', string>>;
}
