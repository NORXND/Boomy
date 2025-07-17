import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'path';
import fs from 'fs';

const config: ForgeConfig = {
	packagerConfig: {
		asar: true,
		extraResource: [
			'../BoomyDeps/makemogg/',
			'../BoomyBuilder/bin/Release/net8.0/',
		],

		ignore: ['node_modules/electron-edge-js', 'node_modules/edge-cs'],
	},
	rebuildConfig: {
		// Ensure native modules are rebuilt for Electron
		force: true,
	},
	makers: [
		new MakerSquirrel({}),
		new MakerZIP({}, ['darwin']),
		new MakerRpm({}),
		new MakerDeb({}),
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
	hooks: {
		// Rebuild native modules before packaging
		prePackage: async (forgeConfig, platform, arch) => {
			console.log('Rebuilding native modules for Electron...');
			const { execSync } = require('child_process');
			try {
				execSync('npx @electron/rebuild -f -w electron-edge-js', {
					stdio: 'inherit',
					cwd: __dirname,
				});
				console.log('Native modules rebuilt successfully!');
			} catch (error) {
				console.error('Failed to rebuild native modules:', error);
				throw error;
			}
		},

		// Ensure native modules are properly copied for production builds
		postPackage: async (forgeConfig, options) => {
			console.log('Copying edge modules for production build');
			const outdir = options.outputPaths[0];
			console.log('Output directory:', outdir);

			// Ensure the edge modules are available in the app resources
			const appNodeModulesPath = path.join(
				outdir,
				'resources',
				'app',
				'node_modules'
			);

			const resourcesNodeModulesPath = path.join(
				outdir,
				'resources',
				'node_modules'
			);

			const modulesToCopy = ['edge-cs', 'electron-edge-js'];

			// Create target directories if they don't exist
			if (!fs.existsSync(resourcesNodeModulesPath)) {
				fs.mkdirSync(resourcesNodeModulesPath, { recursive: true });
			}

			for (const moduleName of modulesToCopy) {
				const sourcePath = path.join(
					__dirname,
					'node_modules',
					moduleName
				);

				// Copy to resources/node_modules
				const resourcesTargetPath = path.join(
					resourcesNodeModulesPath,
					moduleName
				);

				if (fs.existsSync(sourcePath)) {
					console.log(
						`Copying ${moduleName} from:`,
						sourcePath,
						'to:',
						resourcesTargetPath
					);
					fs.cpSync(sourcePath, resourcesTargetPath, {
						recursive: true,
					});
				} else {
					console.warn(`Source path does not exist: ${sourcePath}`);
				}
			}
			console.log('Edge modules copied successfully!');
		},
	},
};

export default config;
