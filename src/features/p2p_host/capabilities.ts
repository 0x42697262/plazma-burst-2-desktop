import type { CapabilityParts } from '#console/feature-types.ts';
import { statusParts } from './capabilities/status/parts.ts';
import { whoParts } from './capabilities/who/parts.ts';
import { kickParts } from './capabilities/kick/parts.ts';
import { tellParts } from './capabilities/tell/parts.ts';
import { sayParts } from './capabilities/say/parts.ts';
import { mapParts } from './capabilities/map/parts.ts';
import { pauseParts } from './capabilities/pause/parts.ts';
import { swapParts } from './capabilities/swap/parts.ts';
import { endroundParts } from './capabilities/endround/parts.ts';
import { unbanallParts } from './capabilities/unbanall/parts.ts';
import { pingParts } from './capabilities/ping/parts.ts';
import { pingActionParts } from './capabilities/ping_action/parts.ts';
import { minReputationParts } from './capabilities/min_reputation/parts.ts';
import { stopParts } from './capabilities/stop/parts.ts';
import { startParts } from './capabilities/start/parts.ts';
import { restartParts } from './capabilities/restart/parts.ts';

export const P2P_HOST_PARTS: readonly CapabilityParts[] = Object.freeze([
  statusParts,
  whoParts,
  kickParts,
  tellParts,
  sayParts,
  mapParts,
  pauseParts,
  swapParts,
  endroundParts,
  unbanallParts,
  pingParts,
  pingActionParts,
  minReputationParts,
  stopParts,
  startParts,
  restartParts,
]);
