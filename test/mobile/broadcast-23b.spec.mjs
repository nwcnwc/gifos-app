import { test, expect } from '@playwright/test';
import { broadcastCases } from '../shared/broadcast-23b.cases.mjs';

// The one broadcast design at phone sizes (this config's phone projects).
broadcastCases(test, expect);
