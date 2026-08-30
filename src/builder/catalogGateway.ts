import { apiJson } from '../auth/apiFetch';
import type { Product } from './catalog';

export type CatalogProductRecord={id:string;externalId:string;manufacturer:string;sku:string;name:string;category:string;unitOfMeasure:string;payload:Product;createdAt:string;updatedAt:string};

export class HttpCatalogGateway {
  constructor(private readonly baseUrl=import.meta.env.VITE_API_URL??'http://localhost:5080'){}
  async upsert(product:Product){return apiJson<CatalogProductRecord>(`${this.baseUrl}/api/catalog/products`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({externalId:product.id,manufacturer:product.manufacturer,sku:product.sku,name:product.name,category:product.category,unitOfMeasure:product.unitOfMeasure,payload:product})});}
  async get(id:string){return apiJson<CatalogProductRecord>(`${this.baseUrl}/api/catalog/products/${encodeURIComponent(id)}`);}
  async search(filters:{manufacturer?:string;category?:string;q?:string}={}){const query=new URLSearchParams();if(filters.manufacturer)query.set('manufacturer',filters.manufacturer);if(filters.category)query.set('category',filters.category);if(filters.q)query.set('q',filters.q);return apiJson<CatalogProductRecord[]>(`${this.baseUrl}/api/catalog/products?${query}`);}
}
