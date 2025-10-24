import Papa from 'papaparse';
import { Deal } from '../types/deals';

export async function loadDealsCSV(): Promise<Deal[]> {
  try {
    const response = await fetch('/data/ac_deals.csv');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header: string) => header.trim(),
        quoteChar: '"',
        escapeChar: '"',
        delimiter: ',',
        newline: '\n',
        skipFirstNLines: 0,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn(`CSV parsing warnings (${results.errors.length} rows skipped):`, 
              results.errors.slice(0, 5));
          }
          
          // Filter out rows with missing critical fields
          const validDeals = (results.data as Deal[]).filter(deal => {
            return deal['Deal ID'] && deal['Owner Name'] && deal.Pipeline && deal['Owner ID'];
          });
          
          console.log(`✅ Loaded ${validDeals.length} valid deals (${results.data.length - validDeals.length} skipped due to missing fields)`);
          
          resolve(validDeals);
        },
        error: (error: Error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        },
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load deals data: ${error.message}`);
    }
    throw new Error('Failed to load deals data: Unknown error');
  }
}