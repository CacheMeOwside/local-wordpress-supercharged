/**
 * renderer.tsx -- Renderer Process Entry Point
 */

import * as LocalRenderer from '@getflywheel/local/renderer';
import { registerDebugConstantsHooks } from './features/debug-constants/DebugSwitches';
import { registerNgrokHooks } from './features/ngrok/NgrokRow';
import { registerConflictTestHooks } from './features/conflict-test/ConflictTestPanel';
import { registerVulnScanHooks } from './features/vuln-scan/VulnScanPanel';
import { registerSnapshotsHooks } from './features/snapshots/SnapshotsPanel';
import { registerSiteSearchHooks } from './features/site-search/site-search.hooks';
import { registerUpdateNoticeBanner } from './features/update-notice/UpdateNoticeBanner';

/**
 * Renderer process entry point. Registers UI hooks for all addon features
 * into Local's Site Overview and Tools tabs.
 *
 * @param context
 */
export default function( context: LocalRenderer.AddonRendererContext ): void {
	const { React, hooks, store } = context;

	registerSiteSearchHooks( React, hooks );
	registerDebugConstantsHooks( React, hooks );
	registerNgrokHooks( React, hooks );
	registerConflictTestHooks( React, hooks );
	registerVulnScanHooks( React, hooks );
	registerSnapshotsHooks( React, hooks );
	registerUpdateNoticeBanner( React, store );
}
