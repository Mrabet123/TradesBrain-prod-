export interface JobReport {
  id: string;
  sessionId: string;
  userId: string;
  createdAt: string;
  versionNumber: number;
  status: 'draft' | 'finalised';
  reportText: string;
  pdfUrl: string | null;
  suggestedAmount: number | null;
  confirmedAmount: number | null;
  sectionsConfig: Record<string, any> | null;
  includesVat: boolean;
  includesLicense: boolean;
}

export interface Quote {
  id: string;
  sessionId: string;
  userId: string;
  createdAt: string;
  versionNumber: number;
  status: 'draft' | 'finalised';
  lineItems: LineItem[];
  labourHours: number | null;
  hourlyRateSnapshot: number | null;
  suggestedRangeMin: number | null;
  suggestedRangeMax: number | null;
  confirmedTotal: number | null;
  paymentTerms: string | null;
  pdfUrl: string | null;
  sectionsConfig: Record<string, any> | null;
  includesVat: boolean;
  includesLicense: boolean;
}

export interface LineItem {
  name: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
}

export interface CodeChunk {
  id: string;
  content: string;
  sectionNumber: string | null;
  documentName: string;
  version: string;
  similarity: number;
}

export interface WorkerPreferences {
  id: string;
  userId: string;
  documentType: 'report' | 'quote';
  sections: string[];
  defaultIncludeVat: boolean;
  defaultIncludeLicense: boolean;
  defaultPaymentTerms: string | null;
}
