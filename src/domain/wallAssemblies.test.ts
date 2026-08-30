import { describe, expect, it } from 'vitest';
import type { ArchitecturalWall } from './building';
import { buildWallLayerBands, validateWallAgainstAssembly, validateWallAssembly, type WallAssembly } from './wallAssemblies';

const assembly: WallAssembly = {
  id:'assembly:exterior-6', name:'Exterior 2x4 + finishes', geometryUnits:'inches',
  layers:[
    {id:'stucco',name:'Stucco',role:'exterior-finish',thickness:.75,materialId:'mat:stucco'},
    {id:'sheathing',name:'Sheathing',role:'sheathing',thickness:.5},
    {id:'stud',name:'Stud cavity',role:'structure',thickness:3.5},
    {id:'drywall',name:'Gypsum board',role:'interior-finish',thickness:.5},
  ],
};

function wall(thickness = 5.25): ArchitecturalWall {
  return {
    id:'w1',levelId:'l1',name:'Exterior Wall',start:{x:0,y:0},end:{x:120,y:0},thickness,height:108,baseElevation:0,
    wallType:'exterior',assemblyId:assembly.id,openingIds:[],lineage:{sourceCadEntityIds:[],validationState:'confirmed'},
  };
}

describe('wall assemblies', () => {
  it('validates layers and sums assembly thickness', () => {
    const result = validateWallAssembly(assembly);
    expect(result.valid).toBe(true);
    expect(result.totalThickness).toBeCloseTo(5.25);
    expect(validateWallAgainstAssembly(wall(), assembly)).toEqual([]);
  });

  it('builds ordered layer bands centered on the wall centerline', () => {
    const bands = buildWallLayerBands(assembly);
    expect(bands[0]).toMatchObject({layerId:'stucco',startOffset:-2.625,endOffset:-1.875});
    expect(bands.at(-1)).toMatchObject({layerId:'drywall',startOffset:2.125,endOffset:2.625});
  });

  it('reports wall/assembly thickness drift instead of silently resizing layers', () => {
    expect(validateWallAgainstAssembly(wall(6), assembly).join(' ')).toContain('does not match assembly thickness');
  });

  it('rejects duplicate, empty, non-positive and unitless assemblies', () => {
    const invalid: WallAssembly = {
      id:'bad',name:'Bad',geometryUnits:'unitless',
      layers:[{id:'x',name:'A',role:'other',thickness:1},{id:'x',name:'B',role:'other',thickness:0}],
    };
    const result = validateWallAssembly(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue=>issue.includes('explicit geometry units'))).toBe(true);
    expect(result.issues.some(issue=>issue.includes('Duplicate'))).toBe(true);
    expect(result.issues.some(issue=>issue.includes('positive thickness'))).toBe(true);
  });
});
