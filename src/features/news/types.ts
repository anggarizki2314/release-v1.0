export interface EconomicEvent {
  id: number;
  timestamp: number; // UTC seconds
  currency: string;  // USD, EUR, GBP, JPY, etc.
  country: string;   // US, EU, GB, JP, etc.
  event_name: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
}

export interface EconomicNewsStats {
  totalEvents: number;
  countByCurrency: Record<string, number>;
  minTime: number | null;
  maxTime: number | null;
}

export interface NewsFilterOptions {
  currencies: string[];
  minImpact?: 'HIGH' | 'MEDIUM' | 'LOW';
  enabled?: boolean;
}
