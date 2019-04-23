import { readFileSync } from 'fs';

export interface Company {
  name: string;
  size: string; // 'Big' | 'Medium' | 'Substantial' | 'Small' | 'Micro';
  ownership: string; // 'Public' | 'Private';
  region: string;
  country: string;
}

export interface Trial {
  phase: string;
  title: string;
  status: string;
  conditions: string[];
  start: string;
  completion: string;
  nct_number: string;
}

export function read_company_list(): Company[] {
  const companies_raw = readFileSync('./companies.csv').toString();
  return companies_raw.split('\n').map((line) => {
    const [num, size, name, ownership, region, country ] = line.split(',');
    return {
      name,
      size,
      ownership,
      region,
      country,
    };
  });
}
