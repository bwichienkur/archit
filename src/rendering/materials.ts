export type TextureRef = { url:string; scaleU?:number; scaleV?:number; rotation?:number };
export type PbrMaterial = { id:string; name:string; baseColor:string; roughness:number; metalness:number; opacity?:number; normal?:TextureRef; albedo?:TextureRef; roughnessMap?:TextureRef; metalnessMap?:TextureRef; ambientOcclusion?:TextureRef; displacement?:TextureRef; doubleSided?:boolean };
export type RenderQuality = 'review'|'standard'|'presentation';
export type RenderQualitySettings = { shadowMapSize:number; antialias:boolean; ambientOcclusion:boolean; reflections:boolean; textureMaxSize:number; devicePixelRatio:number };

export const renderQualityPresets:Record<RenderQuality,RenderQualitySettings> = {
  review:{shadowMapSize:512,antialias:false,ambientOcclusion:false,reflections:false,textureMaxSize:1024,devicePixelRatio:1},
  standard:{shadowMapSize:1024,antialias:true,ambientOcclusion:true,reflections:false,textureMaxSize:2048,devicePixelRatio:1.5},
  presentation:{shadowMapSize:2048,antialias:true,ambientOcclusion:true,reflections:true,textureMaxSize:4096,devicePixelRatio:2},
};

export function validatePbrMaterial(material:PbrMaterial){const issues:string[]=[];if(!material.id.trim())issues.push('Material id is required.');if(!material.name.trim())issues.push('Material name is required.');if(material.roughness<0||material.roughness>1)issues.push('Roughness must be between 0 and 1.');if(material.metalness<0||material.metalness>1)issues.push('Metalness must be between 0 and 1.');if(material.opacity!=null&&(material.opacity<0||material.opacity>1))issues.push('Opacity must be between 0 and 1.');for(const texture of [material.normal,material.albedo,material.roughnessMap,material.metalnessMap,material.ambientOcclusion,material.displacement])if(texture&&(texture.scaleU??1)<=0||(texture&&(texture.scaleV??1)<=0))issues.push('Texture scale must be positive.');return issues;}
