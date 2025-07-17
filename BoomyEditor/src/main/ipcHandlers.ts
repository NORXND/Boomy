import { ipcMain, dialog, shell } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Import edge using require for better compatibility
let edge: any;
try {
	process.env.EDGE_USE_CORECLR = '1';
	edge = require('electron-edge-js');
	console.log('electron-edge-js loaded successfully');
} catch (error) {
	console.error('Failed to load electron-edge-js:', error);
	edge = null;
}

const resourcesPath = process.resourcesPath || path.join(__dirname, '..');

// Dialog handlers
export function setupDialogHandlers() {
	// IPC handlers for file and directory selection
	ipcMain.handle('dialog:selectFile', async (event, options) => {
		const result = await dialog.showOpenDialog(options);
		return result;
	});

	ipcMain.handle('dialog:selectDirectory', async (event, options) => {
		const result = await dialog.showOpenDialog(options);
		return result;
	});

	ipcMain.handle('dialog:selectPath', async (event, options) => {
		const result = await dialog.showOpenDialog(options);
		return result;
	});
}

// Shell handlers
export function setupShellHandlers() {
	// Open external URL
	ipcMain.handle('shell:openExternal', async (event, url: string) => {
		try {
			await shell.openExternal(url);
			return { success: true };
		} catch (error) {
			return { success: false, error: `Failed to open URL: ${error}` };
		}
	});
}

// File system handlers
export function setupFileSystemHandlers() {
	// IPC handlers for file system operations
	ipcMain.handle('fs:readFile', async (event, filePath: string) => {
		try {
			const content = await fs.readFile(filePath, 'utf-8');
			return { success: true, data: content };
		} catch (error) {
			return { success: false, error: `Failed to read file: ${error}` };
		}
	});

	ipcMain.handle('fs:readFileBuffer', async (event, filePath: string) => {
		try {
			const content = await fs.readFile(filePath);
			return { success: true, data: Array.from(content) }; // Convert Buffer to array for IPC
		} catch (error) {
			return { success: false, error: `Failed to read file: ${error}` };
		}
	});

	ipcMain.handle('fs:pathExists', async (event, filePath: string) => {
		try {
			await fs.access(filePath);
			return { success: true, data: true };
		} catch {
			return { success: true, data: false };
		}
	});

	ipcMain.handle('fs:getFileStats', async (event, filePath: string) => {
		try {
			const stats = await fs.stat(filePath);
			return {
				success: true,
				data: {
					isFile: stats.isFile(),
					isDirectory: stats.isDirectory(),
					size: stats.size,
					modified: stats.mtime.toISOString(),
					created: stats.birthtime.toISOString(),
				},
			};
		} catch (error) {
			return {
				success: false,
				error: `Failed to get file stats: ${error}`,
			};
		}
	});

	ipcMain.handle(
		'fs:writeFile',
		async (event, filePath: string, content: string) => {
			try {
				await fs.writeFile(filePath, content, 'utf-8');
				return { success: true };
			} catch (error) {
				return {
					success: false,
					error: `Failed to write file: ${error}`,
				};
			}
		}
	);

	ipcMain.handle('fs:deleteFile', async (event, filePath: string) => {
		try {
			await fs.unlink(filePath);
			return { success: true };
		} catch (error) {
			return { success: false, error: `Failed to delete file: ${error}` };
		}
	});

	ipcMain.handle('fs:createDirectory', async (event, dirPath: string) => {
		try {
			await fs.mkdir(dirPath, { recursive: true });
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: `Failed to create directory: ${error}`,
			};
		}
	});

	ipcMain.handle('fs:readDirectory', async (event, dirPath: string) => {
		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true });
			const items = entries.map((entry) => ({
				name: entry.name,
				isFile: entry.isFile(),
				isDirectory: entry.isDirectory(),
			}));
			return { success: true, data: items };
		} catch (error) {
			return {
				success: false,
				error: `Failed to read directory: ${error}`,
			};
		}
	});

	ipcMain.handle('fs:readJsonFile', async (event, filePath: string) => {
		try {
			const content = await fs.readFile(filePath, 'utf-8');
			const jsonData = JSON.parse(content);
			return { success: true, data: jsonData };
		} catch (error) {
			return {
				success: false,
				error: `Failed to read JSON file: ${error}`,
			};
		}
	});
}

// Edge.js handlers for calling C# code
export function setupEdgeHandlers() {
	ipcMain.handle('edge:callBoomyBuilder', async (_, buildRequest: any) => {
		try {
			// Check if edge is available
			if (!edge) {
				return {
					success: false,
					error: 'electron-edge-js is not available. The module may not be properly compiled for this Electron version.',
				};
			}

			// Find the BoomyBuilder.dll - look in common build locations
			const possiblePaths = [
				path.join(
					process.cwd(),
					'..',
					'BoomyBuilder',
					'bin',
					'Debug',
					'net8.0',
					'BoomyBuilder.dll'
				),
				path.join(__dirname, 'BoomyBuilder.dll'),
				path.join(resourcesPath, 'net8.0', 'BoomyBuilder.dll'),
			];

			let builderDllPath: string | null = null;

			// Find the first existing dll path
			for (const dllPath of possiblePaths) {
				try {
					await fs.access(dllPath);
					builderDllPath = dllPath;
					break;
				} catch {
					// Continue searching
				}
			}

			if (!builderDllPath) {
				return {
					success: false,
					error: 'BoomyBuilder.dll not found. Make sure BoomyBuilder is built first.',
				};
			}

			console.log('Found BoomyBuilder.dll at:', builderDllPath);

			// Create the edge function to call C# method
			// Based on your BuildOperator.cs, we need to call the static BuildFromJson method
			const buildSong = edge.func({
				assemblyFile: builderDllPath,
				typeName: 'BoomyBuilder.Program',
				methodName: 'Build',
			});

			const request = buildRequest;
			request['milo_template_path'] = path.join(
				path.dirname(builderDllPath),
				'Assets',
				'template.milo_xbox'
			);
			request['barks_template_path'] = path.join(
				path.dirname(builderDllPath),
				'Assets',
				'barks_template.milo_xbox'
			);

			console.log(
				'Edge function created, calling with request:',
				JSON.stringify(request, null, 2)
			);

			// Call the C# method with the build request
			const result = await new Promise((resolve, reject) => {
				buildSong(
					JSON.stringify(request),
					(error: any, result: any) => {
						if (error) {
							console.error('Edge.js call error:', error);
							reject(error);
						} else {
							console.log('Edge.js call result:', result);

							if (result == 'OK') {
								resolve(result);
							} else {
								reject();
							}
						}
					}
				);
			});

			console.log('Edge.js call completed successfully:', result);

			return {
				success: true,
				data: result,
			};
		} catch (error) {
			return {
				success: false,
				error: `Failed to call BoomyBuilder: ${error}`,
			};
		}
	});
}

// Audio processing handlers
export function setupAudioHandlers() {
	// Convert OGG to MOGG using makemogg.exe (Windows only)
	ipcMain.handle('audio:convertToMogg', async (event, audioPath: string) => {
		try {
			// Check if running on Windows
			if (process.platform !== 'win32') {
				return {
					success: false,
					error: 'makemogg.exe is only available on Windows',
				};
			}

			// Validate input file exists
			try {
				await fs.access(audioPath);
			} catch {
				return {
					success: false,
					error: `Input file not found: ${audioPath}`,
				};
			}

			// Generate output path by changing extension from .ogg to .mogg
			if (!audioPath.toLowerCase().endsWith('.ogg')) {
				return {
					success: false,
					error: 'Input file must have .ogg extension',
				};
			}

			const outputPath = audioPath.slice(0, -4) + '.mogg';

			const possiblePaths = [
				path.join(
					process.cwd(),
					'..',
					'BoomyDeps',
					'makemogg',
					'makemogg.exe'
				),
				path.join(__dirname, 'makemogg.exe'),
				path.join(resourcesPath, 'makemogg', 'makemogg.exe'),
			];

			let makemoggPath: string | null = null;

			// Find the first existing makemogg path
			for (const dllPath of possiblePaths) {
				try {
					await fs.access(dllPath);
					makemoggPath = dllPath;
					break;
				} catch {
					// Continue searching
				}
			}

			if (!makemoggPath) {
				return {
					success: false,
					error: 'makemogg.exe not found. Make sure BoomyDeps is set up correctly.',
				};
			}

			console.log('Found makemogg.exe at:', makemoggPath);

			// Check if makemogg.exe exists
			try {
				await fs.access(makemoggPath);
			} catch {
				return {
					success: false,
					error: `makemogg.exe not found at: ${makemoggPath}`,
				};
			}

			console.log(
				`Converting ${audioPath} to ${outputPath} using ${makemoggPath}`
			);

			// Execute makemogg.exe with arguments: makemogg.exe <input_ogg> -m <output_mogg>
			const result = await new Promise<{
				success: boolean;
				error?: string;
				output?: string;
			}>((resolve) => {
				const process = spawn(
					makemoggPath,
					[audioPath, '-m', outputPath],
					{
						stdio: ['pipe', 'pipe', 'pipe'],
					}
				);

				let stdout = '';
				let stderr = '';

				process.stdout.on('data', (data) => {
					stdout += data.toString();
				});

				process.stderr.on('data', (data) => {
					stderr += data.toString();
				});

				process.on('close', (code) => {
					if (code === 0) {
						resolve({
							success: true,
							output: stdout,
						});
					} else {
						resolve({
							success: false,
							error: `makemogg.exe exited with code ${code}. Error: ${stderr}`,
						});
					}
				});

				process.on('error', (error) => {
					resolve({
						success: false,
						error: `Failed to start makemogg.exe: ${error.message}`,
					});
				});
			});

			if (result.success) {
				// Verify output file was created
				try {
					await fs.access(outputPath);
					return {
						success: true,
						data: {
							inputPath: audioPath,
							outputPath: outputPath,
							output: result.output,
						},
					};
				} catch {
					return {
						success: false,
						error: 'Output file was not created successfully',
					};
				}
			} else {
				return result;
			}
		} catch (error) {
			return {
				success: false,
				error: `Failed to convert audio: ${error}`,
			};
		}
	});
}

// Setup all handlers
export function setupAllHandlers() {
	setupDialogHandlers();
	setupFileSystemHandlers();
	setupShellHandlers();
	setupEdgeHandlers();
	setupAudioHandlers();
}
