import { create } from 'zustand';
import type { Product } from '../builder/catalog';
import { removeSelection, updateSelectionStatus, type ConfigurationSelection, type ConfigurationSession } from '../builder/configurator';

export type PlatformPanel='closed'|'3d'|'builder'|'schedules';

type PlatformWorkspaceState={
  panel:PlatformPanel;
  session:ConfigurationSession;
  productsById:Record<string,Product>;
  setPanel(panel:PlatformPanel):void;
  setSession(session:ConfigurationSession):void;
  setProducts(products:Product[]):void;
  setSelectionStatus(selectionId:string,status:ConfigurationSelection['status']):void;
  removeTargetSelection(targetId:string):void;
};

export const usePlatformWorkspaceStore=create<PlatformWorkspaceState>((set,get)=>({
  panel:'closed',
  session:{projectId:'local',selections:[]},
  productsById:{},
  setPanel:panel=>set({panel}),
  setSession:session=>set({session}),
  setProducts:products=>set({productsById:Object.fromEntries(products.map(product=>[product.id,product]))}),
  setSelectionStatus:(selectionId,status)=>set({session:updateSelectionStatus(get().session,selectionId,status)}),
  removeTargetSelection:targetId=>set({session:removeSelection(get().session,targetId).session}),
}));
