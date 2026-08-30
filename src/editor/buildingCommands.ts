import type { ArchitecturalWall, BuildingModelV2, WallOpening } from '../domain/building';
import { recalculateInferredRooms } from '../domain/recalculate';

export interface BuildingCommand {
  readonly label: string;
  execute(model: BuildingModelV2): BuildingModelV2;
  undo(model: BuildingModelV2): BuildingModelV2;
}

export class UpdateArchitecturalWallCommand implements BuildingCommand {
  readonly label: string;

  constructor(
    private readonly before: ArchitecturalWall,
    private readonly after: ArchitecturalWall,
    label = 'Update wall',
  ) {
    this.label = label;
  }

  execute(model: BuildingModelV2): BuildingModelV2 {
    return replaceWallAndRecalculate(model, this.after);
  }

  undo(model: BuildingModelV2): BuildingModelV2 {
    return replaceWallAndRecalculate(model, this.before);
  }
}

export class UpdateWallOpeningCommand implements BuildingCommand {
  readonly label: string;

  constructor(
    private readonly before: WallOpening,
    private readonly after: WallOpening,
    label = 'Update opening',
  ) {
    this.label = label;
  }

  execute(model: BuildingModelV2): BuildingModelV2 {
    return replaceOpening(model, this.after);
  }

  undo(model: BuildingModelV2): BuildingModelV2 {
    return replaceOpening(model, this.before);
  }
}

export class BuildingCommandHistory {
  private undoStack: BuildingCommand[] = [];
  private redoStack: BuildingCommand[] = [];

  execute(model: BuildingModelV2, command: BuildingCommand) {
    const next = command.execute(model);
    this.undoStack.push(command);
    this.redoStack = [];
    return next;
  }

  undo(model: BuildingModelV2) {
    const command = this.undoStack.pop();
    if (!command) return model;
    this.redoStack.push(command);
    return command.undo(model);
  }

  redo(model: BuildingModelV2) {
    const command = this.redoStack.pop();
    if (!command) return model;
    this.undoStack.push(command);
    return command.execute(model);
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}

function replaceWallAndRecalculate(model: BuildingModelV2, wall: ArchitecturalWall) {
  return recalculateInferredRooms({
    ...model,
    walls: model.walls.map(item => item.id === wall.id ? wall : item),
  });
}

function replaceOpening(model: BuildingModelV2, opening: WallOpening) {
  return {
    ...model,
    openings: model.openings.map(item => item.id === opening.id ? opening : item),
  };
}
