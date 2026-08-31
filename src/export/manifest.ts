export type ExportFormat='svg'|'pdf'|'dxf'|'dwg'|'ifc'|'gltf'|'obj'|'json'|'csv';
export type ExportArtifact={id:string;format:ExportFormat;fileName:string;mediaType:string;sha256?:string;bytes?:number;sourceRevisionId:string;generatedAt:string;warnings:string[]};
export type ExportManifest={projectId:string;revisionId:string;requestedBy:string;generatedAt:string;artifacts:ExportArtifact[];modelSchemaVersion:number;sourceImportId?:string;sourceCadSha256?:string};

export function validateExportManifest(manifest:ExportManifest){const issues:string[]=[];if(!manifest.projectId.trim())issues.push('Project id is required.');if(!manifest.revisionId.trim())issues.push('Revision id is required.');const names=new Set<string>();for(const artifact of manifest.artifacts){if(names.has(artifact.fileName))issues.push(`Duplicate export filename ${artifact.fileName}.`);names.add(artifact.fileName);if(artifact.sourceRevisionId!==manifest.revisionId)issues.push(`Artifact ${artifact.fileName} was generated from a different revision.`);}return issues;}

export function defaultMediaType(format:ExportFormat){return({svg:'image/svg+xml',pdf:'application/pdf',dxf:'application/dxf',dwg:'application/acad',ifc:'application/x-step',gltf:'model/gltf+json',obj:'model/obj',json:'application/json',csv:'text/csv'} as Record<ExportFormat,string>)[format];}
