export interface Deal {
  'Deal ID': string;
  'Title': string;
  'Status': string;
  'Owner Name': string;
  'Pipeline': string;
  'Stage': string;
  'DISTRIBUTION Time': string;
  'LOST': string;
  'Created': string;
}

export interface PipelineMetrics {
  owner: string;
  stages: {
    [stage: string]: {
      open: number;
      lost: number;
    };
  };
  lostBreakdown: {
    unreachable: number;
    unresponsiveHighValue: number;
  };
}

export type DateFilter = 'last7days' | 'last30days' | 'alltime';