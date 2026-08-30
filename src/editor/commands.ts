import type { BuildingModel, Wall } from '../domain/model';

export interface EditorCommand {
  readonly label: string;
  execute(model: BuildingModel): BuildingModel;
  undo(model: BuildingModel): BuildingModel;
}

function replaceWall(model: BuildingModel, wall: Wall): BuildingModel {
  return { ...model, walls: model.walls.map(item => item.id === wall.id ? wall : item) };
}

export class UpdateWallCommand implements EditorCommand {
  readonly label: string;
  constructor(private readonly before: Wall, private readonly after: Wall, label = 'Update wall') {
    this.label = label;
  }
  execute(model: BuildingModel): BuildingModel { return replaceWall(model, this.after); }
  undo(model: BuildingModel): BuildingModel { return replaceWall(model, this.before); }
}

export class CommandHistory {
  private undoStack: EditorCommand[] = [];
  private redoStack: EditorCommand[] = [];

  execute(model: BuildingModel, command: EditorCommand): BuildingModel {
    const next = command.execute(model);
    this.undoStack.push(command);
    this.redoStack = [];
    return next;
  }

  undo(model: BuildingModel): BuildingModel {
    const command = this.undoStack.pop();
    if (!command) return model;
    this.redoStack.push(command);
    return command.undo(model);
  }

  redo(model: BuildingModel): BuildingModel {
    const command = this.redoStack.pop();
    if (!command) return model;
    this.undoStack.push(command);
    return command.execute(model);
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}
