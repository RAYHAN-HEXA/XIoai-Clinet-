/**
 * Vercel serverless entry — mounts the Express app for every route.
 * The API project deploys from the REPO ROOT (not apps/api) so npm
 * workspaces resolve `@xiaocai/engine` and the root lockfile drives install.
 */
import { createApp } from '../apps/api/src/app';

export default createApp();

// Demo cloning performs dozens of sequential Neon round-trips on a cold start;
// leave generous headroom under the Hobby ceiling.
export const maxDuration = 60;
