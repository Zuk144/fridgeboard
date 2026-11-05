import { SCHEMA_VERSION } from '../shared/payload';

// M0 placeholder. The paper-planner dashboard (M2) replaces this.
const app = document.getElementById('app');
if (app) app.setAttribute('data-schema', String(SCHEMA_VERSION));
