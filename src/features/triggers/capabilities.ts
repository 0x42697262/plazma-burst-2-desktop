import type { CapabilityParts } from '#console/feature-types.ts';
import { listParts } from './capabilities/list/parts.ts';
import { historyParts } from './capabilities/history/parts.ts';
import { findParts } from './capabilities/find/parts.ts';
import { runParts } from './capabilities/run/parts.ts';
import { execParts } from './capabilities/exec/parts.ts';
import { actionsParts } from './capabilities/actions/parts.ts';
import { regionsParts } from './capabilities/regions/parts.ts';
import { regionsRunParts } from './capabilities/regions_run/parts.ts';
import { varsParts } from './capabilities/vars/parts.ts';
import { varsSetParts } from './capabilities/vars_set/parts.ts';
import { varsSyncParts } from './capabilities/vars_sync/parts.ts';
import { logicParts } from './capabilities/logic/parts.ts';
import { logicShowParts } from './capabilities/logic_show/parts.ts';
import { logicTreeParts } from './capabilities/logic_tree/parts.ts';

export const TRIGGERS_PARTS: readonly CapabilityParts[] = Object.freeze([
  listParts,
  historyParts,
  findParts,
  runParts,
  execParts,
  actionsParts,
  regionsParts,
  regionsRunParts,
  varsParts,
  varsSetParts,
  varsSyncParts,
  logicParts,
  logicShowParts,
  logicTreeParts,
]);
