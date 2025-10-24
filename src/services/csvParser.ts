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
        dynamicTyping: false, // Keep all as strings
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error('CSV parsing errors:', results.errors);
            reject(new Error(`CSV parsing failed: ${results.errors[0].message}`));
            return;
          }
          
          resolve(results.data as Deal[]);
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