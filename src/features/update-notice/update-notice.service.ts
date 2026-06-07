/**
 * update-notice.service.ts -- Pure functions for the daily update check.
 *
 * Fetches the addon's latest GitHub release and compares it against the
 * installed version. No state is held here; the IPC layer owns caching and
 * scheduling.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

/** GitHub repository that publishes addon releases. */
export const GITHUB_REPO = 'Sidsector9/local-wordpress-supercharged';

export interface LatestRelease {
	tagName: string;
	htmlUrl: string;
}

/**
 * Parses a version string into numeric components, tolerating a leading "v"
 * and pre-release suffixes (e.g. "v2.3.0-beta" -> [2, 3, 0]).
 *
 * @param version - The version string to parse.
 */
export function parseVersion( version: string ): number[] {
	return String( version )
		.trim()
		.replace( /^v/i, '' )
		.split( '.' )
		.map( ( part ) => parseInt( part, 10 ) || 0 );
}

/**
 * Compares two version strings. Returns 1 if a > b, -1 if a < b, 0 if equal.
 * Missing trailing components are treated as 0, so "2.2" equals "2.2.0".
 *
 * @param a - First version.
 * @param b - Second version.
 */
export function compareVersions( a: string, b: string ): number {
	const pa = parseVersion( a );
	const pb = parseVersion( b );
	const len = Math.max( pa.length, pb.length );
	for ( let i = 0; i < len; i++ ) {
		const da = pa[ i ] || 0;
		const db = pb[ i ] || 0;
		if ( da > db ) {
			return 1;
		}
		if ( da < db ) {
			return -1;
		}
	}
	return 0;
}

/**
 * True when `latest` is a strictly newer version than `current`.
 *
 * @param latest  - The latest available version.
 * @param current - The installed version.
 */
export function isNewerVersion( latest: string, current: string ): boolean {
	if ( ! latest || ! current ) {
		return false;
	}
	return compareVersions( latest, current ) > 0;
}

/**
 * Reads the installed addon version from the bundled package.json.
 * Returns '0.0.0' if it cannot be read.
 */
export function getCurrentVersion(): string {
	try {
		const pkgPath = path.join( __dirname, '..', '..', '..', 'package.json' );
		const pkg = JSON.parse( fs.readFileSync( pkgPath, 'utf8' ) );
		return pkg.version || '0.0.0';
	} catch ( e ) {
		return '0.0.0';
	}
}

/**
 * Fetches the latest (non-draft, non-prerelease) release for the given repo
 * from the GitHub API. Rejects on network errors or non-200 responses.
 *
 * @param repo - The "owner/name" GitHub repository slug.
 */
export function fetchLatestRelease( repo: string = GITHUB_REPO ): Promise<LatestRelease> {
	return new Promise( ( resolve, reject ) => {
		const req = https.request(
			{
				hostname: 'api.github.com',
				path: `/repos/${ repo }/releases/latest`,
				method: 'GET',
				headers: {
					'User-Agent': 'local-addon-wordpress-supercharged',
					Accept: 'application/vnd.github+json',
				},
			},
			( res ) => {
				let body = '';
				res.on( 'data', ( chunk ) => {
					body += chunk;
				} );
				res.on( 'end', () => {
					if ( res.statusCode !== 200 ) {
						reject( new Error( `GitHub API responded with status ${ res.statusCode }` ) );
						return;
					}
					try {
						const json = JSON.parse( body );
						resolve( { tagName: json.tag_name, htmlUrl: json.html_url } );
					} catch ( e: any ) {
						reject( new Error( `Failed to parse GitHub response: ${ e.message }` ) );
					}
				} );
			},
		);

		req.on( 'error', reject );
		req.setTimeout( 10000, () => {
			req.destroy( new Error( 'GitHub API request timed out' ) );
		} );
		req.end();
	} );
}
