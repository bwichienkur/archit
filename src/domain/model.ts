export type Vec2 = { x: number; y: number };

export type Wall = {
  id: string;
  name: string;
  start: Vec2;
  end: Vec2;
  thickness: number;
  height: number;
  sourceCadEntityIds: string[];
  validationState: 'inferred' | 'confirmed' | 'modified';
};

export type Room = {
  id: string;
  name: string;
  type: string;
  area: number;
};

export type BuildingModel = {
  projectName: string;
  units: 'imperial' | 'metric';
  walls: Wall[];
  rooms: Room[];
};

export const demoModel: BuildingModel = {
  projectName: 'Untitled Residence',
  units: 'imperial',
  walls: [
    { id: 'w1', name: 'North Exterior', start: { x: 80, y: 80 }, end: { x: 620, y: 80 }, thickness: 8, height: 10, sourceCadEntityIds: ['CAD-001'], validationState: 'confirmed' },
    { id: 'w2', name: 'East Exterior', start: { x: 620, y: 80 }, end: { x: 620, y: 410 }, thickness: 8, height: 10, sourceCadEntityIds: ['CAD-002'], validationState: 'confirmed' },
    { id: 'w3', name: 'South Exterior', start: { x: 620, y: 410 }, end: { x: 80, y: 410 }, thickness: 8, height: 10, sourceCadEntityIds: ['CAD-003'], validationState: 'confirmed' },
    { id: 'w4', name: 'West Exterior', start: { x: 80, y: 410 }, end: { x: 80, y: 80 }, thickness: 8, height: 10, sourceCadEntityIds: ['CAD-004'], validationState: 'confirmed' },
    { id: 'w5', name: 'Kitchen Partition', start: { x: 350, y: 80 }, end: { x: 350, y: 265 }, thickness: 4.5, height: 10, sourceCadEntityIds: ['CAD-017', 'CAD-018'], validationState: 'inferred' },
    { id: 'w6', name: 'Bedroom Partition', start: { x: 350, y: 265 }, end: { x: 620, y: 265 }, thickness: 4.5, height: 10, sourceCadEntityIds: ['CAD-019'], validationState: 'inferred' }
  ],
  rooms: [
    { id: 'r1', name: 'Living Room', type: 'Living Room', area: 412 },
    { id: 'r2', name: 'Kitchen', type: 'Kitchen', area: 238 },
    { id: 'r3', name: 'Primary Bedroom', type: 'Bedroom', area: 296 }
  ]
};
