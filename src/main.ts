/**
 * main.ts -- Main Process Entry Point
 */

import * as LocalMain from '@getflywheel/local/main';
import { IPC_CHANNELS } from './shared/types';
import { registerDebugConstantsIpc } from './features/debug-constants/debug-constants.ipc';
import { registerNgrokIpc } from './features/ngrok/ngrok.ipc';
import { registerConflictTestIpc } from './features/conflict-test/conflict-test.ipc';
import { registerVulnScanIpc } from './features/vuln-scan/vuln-scan.ipc';
import { registerSnapshotsIpc } from './features/snapshots/snapshots.ipc';
import { registerUpdateNoticeIpc } from './features/update-notice/update-notice.ipc';
import { stopNgrokProcess } from './features/ngrok/ngrok.process';
import { readNgrokCache, writeNgrokCache } from './features/ngrok/ngrok.service';

/**
 * Guards against Local invoking this entry point more than once per process.
 *
 * Without the initialized flag, the function below would otherwise register a second set
 * of IPC listeners and hooks after any Lightning Service (like PHP) is downloaded or upgraded.
 * Everything downstream would then run twice per user action.
 *
 */
let initialized = false;

/**
 * Main process entry point. Registers IPC listeners for all addon features
 * and sets up the siteStopped hook for ngrok cleanup.
 *
 * @param context
 */
export default function( context: LocalMain.AddonMainContext ): void {
	const { wpCli, siteData, siteDatabase, localLogger, userData } = LocalMain.getServiceContainer().cradle;

	const logger = localLogger.child( {
		thread: 'main',
		addon: 'wordpress-supercharged',
	} );

	if (initialized) {
		logger.info('Add-on already initialized in this process. Skipping duplicate registration.');
		return;
	}
	initialized = true;

	registerDebugConstantsIpc( { wpCli, siteData, logger } );
	registerNgrokIpc( { wpCli, siteData, logger } );
	registerConflictTestIpc( { wpCli, siteData, logger } );
	registerVulnScanIpc( { siteData, logger } );
	registerSnapshotsIpc( { wpCli, siteData, siteDatabase, logger } );
	registerUpdateNoticeIpc( { userData, logger } );

	// Auto-cleanup ngrok when a site is stopped
	context.hooks.addAction( 'siteStopped', ( site: any ) => {
		const cached = readNgrokCache( site );
		if ( cached?.enabled ) {
			stopNgrokProcess( site.id );
			writeNgrokCache( siteData, site.id, { enabled: false, url: cached.url } );
			LocalMain.sendIPCEvent( IPC_CHANNELS.NGROK_PROCESS_STATUS_CHANGED, site.id, 'stopped' );
			LocalMain.sendIPCEvent( IPC_CHANNELS.NGROK_CHANGED, site.id, false );
			logger.info( `Stopped ngrok tunnel for site ${ site.id } because site was stopped` );
		}
	} );
}
