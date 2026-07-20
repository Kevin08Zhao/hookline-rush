import type { StageBlueprint } from '../types';

export function validateStage(stage: StageBlueprint): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const addId = (id: string, category: string): void => {
    if (!id.trim()) errors.push(`${category} has an empty id`);
    if (ids.has(id)) errors.push(`Duplicate content id: ${id}`);
    ids.add(id);
  };

  if (stage.width < 1000) errors.push(`${stage.id}: width must be at least 1000`);
  if (stage.finishX <= stage.start.x || stage.finishX > stage.width) {
    errors.push(`${stage.id}: finishX must be after start and inside the stage`);
  }
  if (stage.checkpoints.length === 0) errors.push(`${stage.id}: at least one checkpoint is required`);

  for (const item of [
    ...stage.platforms.map((value) => ({ id: value.id, category: 'platform', x: value.x })),
    ...stage.anchors.map((value) => ({ id: value.id, category: 'anchor', x: value.x })),
    ...stage.hazards.map((value) => ({ id: value.id, category: 'hazard', x: value.x })),
    ...stage.enemies.map((value) => ({ id: value.id, category: 'enemy', x: value.x })),
    ...stage.pickups.map((value) => ({ id: value.id, category: 'pickup', x: value.x })),
  ]) {
    addId(item.id, item.category);
    if (item.x < 0 || item.x > stage.width) errors.push(`${item.id}: x is outside the stage`);
  }

  for (const pickup of stage.pickups) {
    if (pickup.type === 'skill' && !pickup.ability) errors.push(`${pickup.id}: skill pickup needs ability`);
  }
  return errors;
}

export function assertValidStage(stage: StageBlueprint): void {
  const errors = validateStage(stage);
  if (errors.length > 0) throw new Error(`Invalid stage ${stage.id}:\n${errors.join('\n')}`);
}
