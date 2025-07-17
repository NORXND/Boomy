import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
	packagerConfig: {
		asar: true,
		extraResource: (() => {
			const base = ['../BoomyDeps/makemogg/'];
			switch (process.platform) {
				case 'win32':
					base.push(
						'../BoomyBuilder/bin/Release/net8.0/win-x64/publish'
					);
					break;
				case 'darwin':
					base.push(
						'../BoomyBuilder/bin/Release/net8.0/osx-x64/publish'
					);
					break;
				case 'linux':
					base.push(
						'../BoomyBuilder/bin/Release/net8.0/linux-x64/publish'
					);
					break;
				default:
					base.push(
						'../BoomyBuilder/bin/Release/net8.0/win-x64/publish'
					);
			}
			return base;
		})(),
		icon: 'icons/icon',
	},
	rebuildConfig: {
		onlyModules: [],
	},
	makers: [
		new MakerSquirrel({}),
		new MakerZIP({}, ['darwin']),
		new MakerRpm({}),
		new MakerDeb({
			options: {
				icon: 'icons/icon.png',
			},
		}),
	],
	plugins: [
		new VitePlugin({
			// `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
			// If you are familiar with Vite configuration, it will look really familiar.
			build: [
				{
					// `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
					entry: 'src/main.ts',
					config: 'vite.main.config.ts',
					target: 'main',
				},
				{
					entry: 'src/preload.ts',
					config: 'vite.preload.config.ts',
					target: 'preload',
				},
			],
			renderer: [
				{
					name: 'main_window',
					config: 'vite.renderer.config.mjs',
				},
			],
		}),
		// Fuses are used to enable/disable various Electron functionality
		// at package time, before code signing the application
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: true,
		}),
	],
	hooks: {},
};

export default config;
