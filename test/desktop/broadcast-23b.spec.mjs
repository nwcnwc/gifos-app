import { test, expect } from '@playwright/test';
import { broadcastCases } from '../shared/broadcast-23b.cases.mjs';

// The one broadcast design at desktop size (this config's desktop browsers).
broadcastCases(test, expect);
