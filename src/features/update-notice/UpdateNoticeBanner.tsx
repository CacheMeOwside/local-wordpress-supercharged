/**
 * UpdateNoticeBanner.tsx -- App-wide "update available" banner.
 *
 * Registers a banner into Local's global BannerStore with domain ALL so it
 * appears throughout the app, mirroring Local's built-in port-conflict banner.
 * The banner is added only when the main process reports a newer release, and
 * is refreshed live when the daily check pushes a new status.
 */

import * as LocalRenderer from '@getflywheel/local/renderer';
import { Banner } from '@getflywheel/local-components';
import { ipcRenderer } from 'electron';
import { IPC_CHANNELS, UpdateStatus } from '../../shared/types';

let React: typeof import( 'react' );

/** Stable id so the banner can be added/removed idempotently. */
const BANNER_ID = 'wordpress-supercharged-update-notice';

/**
 * Registers the app-wide update-notice banner into Local's BannerStore and
 * wires it to the main-process update check.
 *
 * @param _React - React instance from the addon context.
 * @param store  - RootStore from the addon context (provides $banner).
 */
export function registerUpdateNoticeBanner(
	_React: typeof import( 'react' ),
	store: LocalRenderer.RootStore,
): void {
	React = _React;

	const openRelease = ( url?: string ): void => {
		if ( url ) {
			LocalRenderer.ipcAsync( IPC_CHANNELS.OPEN_RELEASE_URL, url ).catch( () => {} );
		}
	};

	const apply = ( status: UpdateStatus | null ): void => {
		// Always clear first so re-checks don't stack duplicate banners.
		store.$banner.removeBanner( BANNER_ID );

		if ( ! status || ! status.updateAvailable ) {
			return;
		}

		store.$banner.addBanner( {
			id: BANNER_ID,
			domain: LocalRenderer.BannerStoreDomain.ALL,
			component: () => (
				<Banner
					variant="neutral"
					buttonText="View release"
					buttonOnClick={ () => openRelease( status.releaseUrl ) }
				>
					{ `A new version of Local WordPress Supercharged is available (${ status.latestVersion }).` }
				</Banner>
			),
		} );
	};

	// Fetch the cached/initial status on load.
	LocalRenderer.ipcAsync( IPC_CHANNELS.GET_UPDATE_STATUS )
		.then( ( status: UpdateStatus ) => apply( status ) )
		.catch( () => {} );

	// Refresh when the daily check pushes a new status while the app is open.
	ipcRenderer.on(
		IPC_CHANNELS.UPDATE_STATUS_CHANGED,
		( _event: any, status: UpdateStatus ) => apply( status ),
	);
}
