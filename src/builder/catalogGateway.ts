import { apiFetch, apiJson } from '../auth/apiFetch';
import type { Product } from './catalog';

export type CatalogProductRecord={id:string;externalId:string;manufacturer:string;sku:string;name:string;category:string;unitOfMeasure:string;payload:Product;createdAt:string;updatedAt:string};
export type CatalogImportIssue={row:number;field:string|null;message:string};
export type CatalogImportProduct={externalId:string;manufacturer:string;sku:string;name:string;category:string;unitOfMeasure:string;payload:Product};
export type CatalogImportPreview={fileName:string;format:string;sourceRowCount:number;products:CatalogImportProduct[];issues:CatalogImportIssue[]};
export type CatalogImportApplyResult={applied:number;products:CatalogProductRecord[]};

export class HttpCatalogGateway {
  constructor(private readonly baseUrl=import.meta.env.VITE_API_URL??'http://localhost:5080'){}
  async upsert(product:Product){return apiJson<CatalogProductRecord>(`${this.baseUrl}/api/catalog/products`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({externalId:product.id,manufacturer:product.manufacturer,sku:product.sku,name:product.name,category:product.category,unitOfMeasure:product.unitOfMeasure,payload:product})});}
  async get(id:string){return apiJson<CatalogProductRecord>(`${this.baseUrl}/api/catalog/products/${encodeURIComponent(id)}`);}
  async search(filters:{manufacturer?:string;category?:string;q?:string}={}){const query=new URLSearchParams();if(filters.manufacturer)query.set('manufacturer',filters.manufacturer);if(filters.category)query.set('category',filters.category);if(filters.q)query.set('q',filters.q);return apiJson<CatalogProductRecord[]>(`${this.baseUrl}/api/catalog/products?${query}`);}
  async previewImport(file:File){const form=new FormData();form.append('file',file);const response=await apiFetch(`${this.baseUrl}/api/catalog/imports/preview`,{method:'POST',body:form});return readJson<CatalogImportPreview>(response);}
  async applyImport(products:CatalogImportProduct[]){return apiJson<CatalogImportApplyResult>(`${this.baseUrl}/api/catalog/imports/apply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({products})});}
}

async function readJson<T>(response:Response):Promise<T>{const body=await response.json().catch(()=>null) as (T&{error?:string;detail?:string})|null;if(!response.ok)throw new Error(body?.error??body?.detail??`Request failed with HTTP ${response.status}.`);if(!body)throw new Error('API returned an empty response.');return body;}
