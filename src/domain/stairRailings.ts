import type { Point2 } from './building';
import type { StairLayout } from './stairAdvanced';

export type StairRailingPath={
  id:string;
  flightId:string;
  side:'left'|'right';
  start:Point2;
  end:Point2;
  startElevation:number;
  endElevation:number;
  guardHeight:number;
};

export type StairRailingOptions={
  left?:boolean;
  right?:boolean;
  guardHeight?:number;
};

export function buildStairRailingPaths(layout:StairLayout,options:StairRailingOptions={}):StairRailingPath[]{
  const includeLeft=options.left!==false;
  const includeRight=options.right!==false;
  const guardHeight=options.guardHeight??3;
  if(!(guardHeight>0))throw new Error('Railing guard height must be positive.');
  const paths:StairRailingPath[]=[];
  for(const flight of layout.flights){
    const run=Math.max(0,(flight.riserCount-1)*flight.treadDepth);
    const c=Math.cos(flight.rotation),s=Math.sin(flight.rotation);
    const lateral={x:-s,y:c};
    const forward={x:c,y:s};
    const baseStart=flight.riserStart*flight.riserHeight;
    const baseEnd=(flight.riserStart+flight.riserCount)*flight.riserHeight;
    for(const side of ['left','right'] as const){
      if(side==='left'&&!includeLeft)continue;
      if(side==='right'&&!includeRight)continue;
      const sign=side==='left'?1:-1;
      const offset=flight.width/2*sign;
      const start={x:flight.start.x+lateral.x*offset,y:flight.start.y+lateral.y*offset};
      const end={x:start.x+forward.x*run,y:start.y+forward.y*run};
      paths.push({id:`${flight.id}:rail:${side}`,flightId:flight.id,side,start,end,startElevation:baseStart,endElevation:baseEnd,guardHeight});
    }
  }
  return paths;
}
