import * as puppeteer from 'puppeteer';
import { Browser } from 'puppeteer';
import { readFileSync , writeFileSync, existsSync } from 'fs';
import { read_company_list } from './company';
import fetch from 'node-fetch';

const COMPANY_SEARCH_BASE = 'https://clinicaltrials.gov/ct2/results/download_fields?cond=cancer&term="$$term$$"&down_count=1000&down_fmt=csv&down_flds=all';

type Link = CompanySearchOrder | TrialDetailOrder;

interface CompanySearchOrder {
  company_name: string;
  type: 'company_search_order';
}

function isCompanySearchOrder(o: any): o is CompanySearchOrder {
  return o && o.type === 'company_search_order';
}

interface TrialDetailOrder {
  company_name: string;
  nct_number: string;
  type: 'trial_detail_order';
}

function isTrialDetailOrder(o: any): o is TrialDetailOrder {
  return o && o.type === 'trial_detail_order';
}

// function wait(n: number): Promise<void> {
//   return new Promise((resolve) => {
//     setTimeout(() => {
//       resolve();
//     }, n);
//   });
// }

const start = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    args: ["--no-sandbox"],
    defaultViewport: {
      width: 1366,
      height: 768,
    },
  });

  const scraper = new Scraper(browser);

  let links: Link[] = read_company_list().map((company) => ({
    company_name: company.name,
    type: 'company_search_order',
  }) as CompanySearchOrder);

  while (links.length > 0) {
    const to_extract = links.slice(0, 4);
    links = links.slice(4);

    await Promise.all(to_extract.map(async (next) => {
      try {
        if (isCompanySearchOrder(next)) {
          const scraped: Link[] = await scraper.scrape_company(next);
          links = [...scraped, ...links];
        } else if (isTrialDetailOrder(next)) {
          console.log(`ToImplement TrialDetailScrape ${next.company_name} - ${next.nct_number}`);
        }
      } catch (err) {
        console.error(`Failure`, err, next);
      }
    }));

    process.stdout.write('.');
  }

  scraper.persist_memory();
  writeFileSync('trials.json', {});

  console.log(`Scraped ${scraper.counter} pages`);
};

class Scraper {
  public counter: number;
  private browser: Browser;
  private memory: {[k: string]: Link[]};

  constructor(browser: Browser) {
    this.counter = 0;
    this.browser = browser;
    if (existsSync('memory.json')) {
      this.memory = JSON.parse(readFileSync('memory.json').toString());
    } else {
      this.memory = {};
    }
  }

  public async scrape_company(company: CompanySearchOrder): Promise<TrialDetailOrder[]> {
    const url = COMPANY_SEARCH_BASE.replace('$$term$$', company.company_name.replace(' ', '+'));
    if (this.memory[company.company_name]) {
      return this.memory[url] as TrialDetailOrder[];
    }
    try {
      const links = await fetch(url).then((result) => {
        if (result.ok) {
          return result.text();
        } else {
          throw new Error('Error fetching data');
        }
      })
      .then((result) => {
        const lines = result.split('\n');
        const properties = lines[0].split(',').map((key) => key.substring(1, key.length - 1));
        const vals = lines.slice(1);
        return vals.map((line) => {
          const line_content = line.split(',').map((key) => key.substring(1, key.length - 1));
          return properties.reduce((acc, property, i) => {
            return {...acc, [property]: line_content[i]};
          }, {}) as TrialDetailOrder;
        });
      });
      this.counter = this.counter + 1;
      this.memory[company.company_name] = links as any;
      if (this.counter % 100 === 0) {
        this.persist_memory();
      }
      return links;
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  public persist_memory(): void {
    console.log('\nPersisting state...');
    writeFileSync('memory.json', JSON.stringify(this.memory));
    console.log('State persisted!');
  }
}

start();
