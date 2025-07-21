import { ipcMain, dialog, shell } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Import edge using require for better compatibility

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

	ipcMain.handle('dialog:selectSavePath', async (event, options) => {
		const result = await dialog.showSaveDialog({
			title: options.title,
			defaultPath: options.defaultPath,
			filters: options.fileTypes || [
				{ name: 'All Files', extensions: ['*'] },
			],
		});
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

	ipcMain.handle(
		'fs:writeFileBuffer',
		async (event, filePath, bufferArray) => {
			try {
				const buffer = Buffer.from(bufferArray);
				await fs.writeFile(filePath, buffer);
				return { success: true };
			} catch (error) {
				return {
					success: false,
					error: `Failed to write binary file: ${error}`,
				};
			}
		}
	);
}

// Edge.js handlers for calling C# code
export function setupEdgeHandlers() {
	ipcMain.handle('edge:callBoomyBuilder', async (_, buildRequest: any) => {
		try {
			// Determine executable name and possible paths per platform
			let exeName = 'BoomyBuilder';
			if (process.platform === 'win32') exeName += '.exe';

			const platformsMap = {
				win32: 'win-x64',
				darwin: 'osx-x64',
				linux: 'linux-x64',
			};

			const platformKey = ((): 'win32' | 'darwin' | 'linux' => {
				if (
					process.platform === 'win32' ||
					process.platform === 'darwin' ||
					process.platform === 'linux'
				) {
					return process.platform;
				}
				return 'win32';
			})();

			const debugPath = path.join(
				process.cwd(),
				'..',
				'BoomyBuilder',
				'bin',
				'Debug',
				'net8.0',
				platformsMap[platformKey],
				exeName
			);
			const releasePath = path.join(
				process.cwd(),
				'..',
				'BoomyBuilder',
				'bin',
				'Release',
				'net8.0',
				platformsMap[platformKey],
				exeName
			);
			const prodPath = path.join(resourcesPath, 'publish', exeName);

			const possiblePaths = [debugPath, releasePath, prodPath];

			let builderExePath: string | null = null;
			for (const exePath of possiblePaths) {
				try {
					await fs.access(exePath);
					builderExePath = exePath;
					break;
				} catch {
					// Continue searching
				}
			}

			if (!builderExePath) {
				return {
					success: false,
					error: `${exeName} not found. Make sure BoomyBuilder is built first.`,
				};
			}

			console.log(`Found BoomyBuilder executable at: ${builderExePath}`);

			// Prepare request JSON
			const request = buildRequest;
			request['milo_template_path'] = path.join(
				path.dirname(builderExePath),
				'Assets',
				'template.milo_xbox'
			);
			request['barks_template_path'] = path.join(
				path.dirname(builderExePath),
				'Assets',
				'barks_template.milo_xbox'
			);
			request['songs_dta_path'] = path.join(
				path.dirname(builderExePath),
				'Assets',
				'songs.dta'
			);

			// Spawn the process and send JSON via stdin
			return await new Promise((resolve) => {
				const child = spawn(builderExePath, [], {
					stdio: ['pipe', 'pipe', 'pipe'],
				});
				let stdout = '';
				let stderr = '';

				child.stdout.on('data', (data) => {
					stdout += data.toString();
				});
				child.stderr.on('data', (data) => {
					stderr += data.toString();
				});
				child.on('close', async (code) => {
					let output;
					let parseError = false;
					try {
						output = JSON.parse(stdout.trim());
						resolve(output);
					} catch (e) {
						parseError = true;
						output = {
							success: false,
							error: 'Failed to parse BoomyBuilder output',
							details: stdout + stderr,
						};
					}
					if (parseError || (output && output.success === false)) {
						try {
							await fs.writeFile(
								'build.log',
								`STDIN:\n${JSON.stringify(
									request
								)}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`
							);
						} catch (logErr) {
							console.error('Failed to write build.log:', logErr);
						}
					}
					if (parseError) resolve(output);
				});
				child.stdin.write(JSON.stringify(request));
				child.stdin.end();
			});
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
