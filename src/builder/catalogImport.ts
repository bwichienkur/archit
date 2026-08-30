import type { Product, ProductCategory, UnitOfMeasure } from './catalog';

export type CatalogImportIssue = { row:number; field?:string; message:string };
export type CatalogImportResult = { products:Product[]; issues:CatalogImportIssue[] };

const categories = new Set<ProductCategory>(['flooring','tile','roofing','cabinet','countertop','faucet','sink','plumbing-fixture','lighting','appliance','door','window','hardware','baseboard','crown-molding','paint','stone','paver','furniture']);
const units = new Set<UnitOfMeasure>(['each','sqft','linear-ft','box','gallon']);

export function importCatalogCsv(csv:string):CatalogImportResult {
  const rows=parseCsv(csv); const issues:CatalogImportIssue[]=[]; const products:Product[]=[];
  if(rows.length===0)return {products,issues:[{row:0,message:'Catalog file is empty.'}]};
  const headers=rows[0].map(h=>h.trim());
  const required=['id','manufacturer','sku','name','category','unitOfMeasure'];
  for(const field of required) if(!headers.includes(field)) issues.push({row:1,field,message:`Missing required column ${field}.`});
  if(issues.length)return {products,issues};
  const index=(name:string)=>headers.indexOf(name);
  for(let r=1;r<rows.length;r++){
    const cells=rows[r]; if(cells.every(cell=>!cell.trim()))continue; const row=r+1;
    const value=(name:string)=>cells[index(name)]?.trim()??'';
    const category=value('category') as ProductCategory; const uom=value('unitOfMeasure') as UnitOfMeasure;
    if(!categories.has(category)){issues.push({row,field:'category',message:`Unknown product category ${category}.`});continue;}
    if(!units.has(uom)){issues.push({row,field:'unitOfMeasure',message:`Unknown unit of measure ${uom}.`});continue;}
    const requiredValues=['id','manufacturer','sku','name'].filter(field=>!value(field));
    if(requiredValues.length){requiredValues.forEach(field=>issues.push({row,field,message:`${field} is required.`}));continue;}
    const dimensions=dimensionObject(value('width'),value('height'),value('depth'),value('dimensionUnit'),row,issues);
    products.push({
      id:value('id'),manufacturer:value('manufacturer'),sku:value('sku'),name:value('name'),category,unitOfMeasure:uom,
      collection:optional(value('collection')),model:optional(value('model')),dimensions,
      coveragePerUnit:numberValue(value('coveragePerUnit'),row,'coveragePerUnit',issues),
      defaultWasteFactor:numberValue(value('defaultWasteFactor'),row,'defaultWasteFactor',issues),
      materialCost:numberValue(value('materialCost'),row,'materialCost',issues),laborCost:numberValue(value('laborCost'),row,'laborCost',issues),markupPercent:numberValue(value('markupPercent'),row,'markupPercent',issues),
      imageUrl:optional(value('imageUrl')),modelUrl:optional(value('modelUrl')),specificationUrl:optional(value('specificationUrl')),metadata:metadataFromRow(headers,cells),
    });
  }
  const duplicates=findDuplicates(products.map(product=>product.id)); duplicates.forEach(id=>issues.push({row:0,field:'id',message:`Duplicate product id ${id}.`}));
  return {products,issues};
}

export function catalogImportTemplate(){return 'id,manufacturer,collection,model,sku,name,category,unitOfMeasure,width,height,depth,dimensionUnit,coveragePerUnit,defaultWasteFactor,materialCost,laborCost,markupPercent,imageUrl,modelUrl,specificationUrl\n';}

function parseCsv(input:string){const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<input.length;i++){const ch=input[i];if(ch==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=ch;}if(cell.length||row.length){row.push(cell);rows.push(row);}return rows;}
function optional(v:string){return v||undefined;}
function numberValue(v:string,row:number,field:string,issues:CatalogImportIssue[]){if(!v)return undefined;const n=Number(v);if(!Number.isFinite(n)){issues.push({row,field,message:`${field} must be numeric.`});return undefined;}return n;}
function dimensionObject(w:string,h:string,d:string,u:string,row:number,issues:CatalogImportIssue[]){if(!w&&!h&&!d)return undefined;if(u!=='in'&&u!=='mm'){issues.push({row,field:'dimensionUnit',message:'dimensionUnit must be in or mm when dimensions are supplied.'});return undefined;}return{width:numberValue(w,row,'width',issues),height:numberValue(h,row,'height',issues),depth:numberValue(d,row,'depth',issues),unit:u as'in'|'mm'};}
function metadataFromRow(headers:string[],cells:string[]){const known=new Set(['id','manufacturer','collection','model','sku','name','category','unitOfMeasure','width','height','depth','dimensionUnit','coveragePerUnit','defaultWasteFactor','materialCost','laborCost','markupPercent','imageUrl','modelUrl','specificationUrl']);const metadata:Record<string,string|number|boolean|null>={};headers.forEach((header,i)=>{if(!known.has(header)&&cells[i]?.trim())metadata[header]=cells[i].trim();});return metadata;}
function findDuplicates(values:string[]){const seen=new Set<string>(),duplicates=new Set<string>();values.forEach(v=>seen.has(v)?duplicates.add(v):seen.add(v));return [...duplicates];}
