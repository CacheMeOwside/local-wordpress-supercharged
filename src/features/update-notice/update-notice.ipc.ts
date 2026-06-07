/**
 * update-notice.ipc.ts -- IPC handlers and daily scheduling for the
 * update-notice feature.
 *
 * Owns the cache (persisted via UserData) and the once-per-day check loop.
 * The renderer pulls the current status via GET_UPDATE_STATUS on mount and
 * receives live refreshes via the UPDATE_STATUS_CHANGED push event.
 */

import { shell } from 'electron';
import * as LocalMain from '@getflywheel/local/main';
import { IPC_CHANNELS, UpdateStatus } from '../../shared/types';
import {
	GITHUB_REPO,
	fetchLatestRelease,
	getCurrentVersion,
	isNewerVersion,
} from './update-notice.service';

export interface UpdateNoticeIpcDeps {
	userData: typeof LocalMain.UserData;
	logger: { info: ( msg: string ) => void; warn: ( msg: string ) => void };
}

/** UserData key holding the cached release-check result. */
const CACHE_KEY = 'wordpressSuperchargedUpdateCheck';

/** Re-check at most once per 24 hours. */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface CachedCheck {
	checkedAt: number;
	latestVersion?: string;
	releaseUrl?: string;
}

/**
 * Registers update-check IPC listeners and starts the daily check loop.
 *
 * @param deps - Service dependencies injected from main.ts.
 */
export function registerUpdateNoticeIpc( deps: UpdateNoticeIpcDeps ): void {
	const { userData, logger } = deps;

	const buildStatus = ( current: string, record: CachedCheck ): UpdateStatus => ( {
		updateAvailable: record.latestVersion ? isNewerVersion( record.latestVersion, current ) : false,
		currentVersion: current,
		latestVersion: record.latestVersion,
		releaseUrl: record.releaseUrl,
		checkedAt: record.checkedAt,
	} );

	/**
	 * Returns the update status, fetching from GitHub when the cache is older
	 * than CHECK_INTERVAL_MS (or when forced). Falls back to cache on error.
	 *
	 * @param force - When true, ignores the cache and always fetches.
	 */
	const getStatus = async ( force = false ): Promise<UpdateStatus> => {
		const current = getCurrentVersion();
		const cached = userData.get( CACHE_KEY, {} ) as CachedCheck;
		const now = Date.now();

		const cacheFresh = !! cached.checkedAt && ( now - cached.checkedAt ) < CHECK_INTERVAL_MS;
		if ( ! force && cacheFresh ) {
			return buildStatus( current, cached );
		}

		try {
			const { tagName, htmlUrl } = await fetchLatestRelease( GITHUB_REPO );
			const record: CachedCheck = { checkedAt: now, latestVersion: tagName, releaseUrl: htmlUrl };
			userData.set( CACHE_KEY, record );
			logger.info( `Update check: latest=${ tagName }, current=${ current }` );
			return buildStatus( current, record );
		} catch ( e: any ) {
			logger.warn( `Update check failed: ${ e.message }` );
			if ( cached.checkedAt ) {
				return buildStatus( current, cached );
			}
			return { updateAvailable: false, currentVersion: current, checkedAt: now, error: e.message };
		}
	};

	// Renderer asks for the current status (used on mount to render the banner).
	LocalMain.addIpcAsyncListener(
		IPC_CHANNELS.GET_UPDATE_STATUS,
		async (): Promise<UpdateStatus> => getStatus( false ),
	);

	// Renderer requests opening the release page in the default browser.
	LocalMain.addIpcAsyncListener(
		IPC_CHANNELS.OPEN_RELEASE_URL,
		async ( url: string ): Promise<void> => {
			if ( typeof url === 'string' && url.startsWith( 'https://github.com/' ) ) {
				await shell.openExternal( url );
			}
		},
	);

	// Run an initial check on load and then once per day while the app runs.
	const runScheduledCheck = async (): Promise<void> => {
		const status = await getStatus( false );
		LocalMain.sendIPCEvent( IPC_CHANNELS.UPDATE_STATUS_CHANGED, status );
	};

	void runScheduledCheck();
	setInterval( () => {
		void runScheduledCheck();
	}, CHECK_INTERVAL_MS );
}
