import 'jest-extended';
import {
	parseVersion,
	compareVersions,
	isNewerVersion,
	getCurrentVersion,
} from './update-notice.service';

describe( 'parseVersion', () => {
	it( 'strips a leading v and parses components', () => {
		expect( parseVersion( 'v2.3.1' ) ).toEqual( [ 2, 3, 1 ] );
		expect( parseVersion( '2.3.1' ) ).toEqual( [ 2, 3, 1 ] );
	} );

	it( 'tolerates pre-release suffixes', () => {
		expect( parseVersion( 'v2.3.0-beta' ) ).toEqual( [ 2, 3, 0 ] );
	} );

	it( 'coerces non-numeric components to zero', () => {
		expect( parseVersion( 'vX.Y' ) ).toEqual( [ 0, 0 ] );
	} );
} );

describe( 'compareVersions', () => {
	it( 'treats missing trailing components as zero', () => {
		expect( compareVersions( '2.2', '2.2.0' ) ).toBe( 0 );
	} );

	it( 'orders versions numerically (not lexically)', () => {
		expect( compareVersions( '2.3.0', '2.2.0' ) ).toBe( 1 );
		expect( compareVersions( '2.2.0', '2.3.0' ) ).toBe( -1 );
		expect( compareVersions( 'v2.10.0', 'v2.9.0' ) ).toBe( 1 );
	} );
} );

describe( 'isNewerVersion', () => {
	it( 'detects strictly newer releases', () => {
		expect( isNewerVersion( 'v2.3', '2.2.0' ) ).toBe( true );
		expect( isNewerVersion( 'v2.2', '2.2.0' ) ).toBe( false );
		expect( isNewerVersion( 'v2.1', '2.2.0' ) ).toBe( false );
	} );

	it( 'returns false for empty input', () => {
		expect( isNewerVersion( '', '2.2.0' ) ).toBe( false );
		expect( isNewerVersion( 'v2.3', '' ) ).toBe( false );
	} );
} );

describe( 'getCurrentVersion', () => {
	it( 'reads a semver string from the bundled package.json', () => {
		expect( getCurrentVersion() ).toMatch( /^\d+\.\d+\.\d+/ );
	} );
} );
