import type { BuildingModelV2 } from '../domain/building';
import { buildOpeningSchedule, openingScheduleToCsv } from '../domain/schedules';
import { buildFixtureSchedule, buildRoofSchedule, buildRoomFinishSchedule, buildStairSchedule } from '../domain/advancedSchedules';

export type ScheduleExportPanelProps={model:BuildingModelV2;onDownload?(fileName:string,content:string,mediaType:string):void};

export function ScheduleExportPanel({model,onDownload}:ScheduleExportPanelProps){
  const openings=buildOpeningSchedule(model),rooms=buildRoomFinishSchedule(model),stairs=buildStairSchedule(model),roofs=buildRoofSchedule(model),fixtures=buildFixtureSchedule(model);
  return <section className="schedule-export-panel" aria-label="Schedules and exports"><header><div><small>CONSTRUCTION DATA</small><strong>Schedules</strong></div><button onClick={()=>onDownload?.('opening-schedule.csv',openingScheduleToCsv(model),'text/csv')}>Export opening CSV</button></header><div className="schedule-counts"><span>Openings {openings.length}</span><span>Rooms {rooms.length}</span><span>Stairs {stairs.length}</span><span>Roof planes {roofs.length}</span><span>Fixtures {fixtures.length}</span></div><div className="schedule-preview"><table><thead><tr><th>Mark</th><th>Type</th><th>Host</th><th>Width</th><th>Height</th></tr></thead><tbody>{openings.slice(0,12).map(row=><tr key={row.openingId}><td>{row.mark}</td><td>{row.kind}</td><td>{row.hostWallName}</td><td>{row.width}</td><td>{row.height}</td></tr>)}</tbody></table>{openings.length===0&&<p>No hosted openings available for scheduling.</p>}</div></section>;
}
