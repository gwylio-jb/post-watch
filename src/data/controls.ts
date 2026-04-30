import type { AnnexAControl } from './types';
import { organisationalControls } from './controls-organisational';
import { peopleControls, physicalControls } from './controls-people-physical';
import { technologicalControls } from './controls-technological';

export const allControls: AnnexAControl[] = [
  ...organisationalControls,
  ...peopleControls,
  ...physicalControls,
  ...technologicalControls,
];

export { organisationalControls, peopleControls, physicalControls, technologicalControls };
