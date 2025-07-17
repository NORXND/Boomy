// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// File reading and path selection API
const electronAPI = {
	// Read file content
	readFile: async (filePath: string): Promise<string> => {
		const result = await ipcRenderer.invoke('fs:readFile', filePath);
		if (result.success) {
			return result.data;
		} else {
			throw new Error(result.error);
		}
	},

	// Read file as buffer (for binary files)
	readFileBuffer: async (filePath: string): Promise<Buffer> => {
		const result = await ipcRenderer.invoke('fs:readFileBuffer', filePath);
		if (result.success) {
			return Buffer.from(result.data); // Convert array back to Buffer
		} else {
			throw new Error(result.error);
		}
	},

	// Select file path with dialog
	selectFilePath: async (
		options: {
			multiple?: boolean;
			fileTypes?: Array<{ name: string; extensions: string[] }>;
			title?: string;
		} = {}
	): Promise<string | string[] | null> => {
		try {
			const result = await ipcRenderer.invoke('dialog:selectFile', {
				properties: [
					'openFile',
					...(options.multiple ? ['multiSelections'] : []),
				],
				filters: options.fileTypes || [
					{ name: 'All Files', extensions: ['*'] },
				],
				title: options.title || 'Select File(s)',
			});

			if (result.canceled) {
				return null;
			}

			return options.multiple ? result.filePaths : result.filePaths[0];
		} catch (error) {
			throw new Error(`Failed to select file: ${error}`);
		}
	},

	// Select directory path with dialog
	selectDirectoryPath: async (
		options: {
			multiple?: boolean;
			title?: string;
		} = {}
	): Promise<string | string[] | null> => {
		try {
			const result = await ipcRenderer.invoke('dialog:selectDirectory', {
				properties: [
					'openDirectory',
					...(options.multiple ? ['multiSelections'] : []),
				],
				title: options.title || 'Select Directory',
			});

			if (result.canceled) {
				return null;
			}

			return options.multiple ? result.filePaths : result.filePaths[0];
		} catch (error) {
			throw new Error(`Failed to select directory: ${error}`);
		}
	},

	// Select path (file or directory) with custom options
	selectPath: async (options: {
		type: 'file' | 'directory' | 'both';
		multiple?: boolean;
		fileTypes?: Array<{ name: string; extensions: string[] }>;
		title?: string;
	}): Promise<string | string[] | null> => {
		try {
			const properties: string[] = [];

			if (options.type === 'file' || options.type === 'both') {
				properties.push('openFile');
			}
			if (options.type === 'directory' || options.type === 'both') {
				properties.push('openDirectory');
			}
			if (options.multiple) {
				properties.push('multiSelections');
			}

			const result = await ipcRenderer.invoke('dialog:selectPath', {
				properties,
				filters: options.fileTypes || [
					{ name: 'All Files', extensions: ['*'] },
				],
				title: options.title || 'Select Path',
			});

			if (result.canceled) {
				return null;
			}

			return options.multiple ? result.filePaths : result.filePaths[0];
		} catch (error) {
			throw new Error(`Failed to select path: ${error}`);
		}
	},

	// Check if path exists
	pathExists: async (path: string): Promise<boolean> => {
		const result = await ipcRenderer.invoke('fs:pathExists', path);
		if (result.success) {
			return result.data;
		} else {
			throw new Error(result.error);
		}
	},

	// Get file stats
	getFileStats: async (path: string) => {
		const result = await ipcRenderer.invoke('fs:getFileStats', path);
		if (result.success) {
			return {
				...result.data,
				modified: new Date(result.data.modified),
				created: new Date(result.data.created),
			};
		} else {
			throw new Error(result.error);
		}
	},

	// Write file content
	writeFile: async (filePath: string, content: string): Promise<void> => {
		const result = await ipcRenderer.invoke(
			'fs:writeFile',
			filePath,
			content
		);
		if (!result.success) {
			throw new Error(result.error);
		}
	},

	// Delete file
	deleteFile: async (filePath: string): Promise<void> => {
		const result = await ipcRenderer.invoke('fs:deleteFile', filePath);
		if (!result.success) {
			throw new Error(result.error);
		}
	},

	// Create directory
	createDirectory: async (dirPath: string): Promise<void> => {
		const result = await ipcRenderer.invoke('fs:createDirectory', dirPath);
		if (!result.success) {
			throw new Error(result.error);
		}
	},

	// Read directory contents
	readDirectory: async (
		dirPath: string
	): Promise<
		Array<{ name: string; isFile: boolean; isDirectory: boolean }>
	> => {
		const result = await ipcRenderer.invoke('fs:readDirectory', dirPath);
		if (result.success) {
			return result.data;
		} else {
			throw new Error(result.error);
		}
	},

	// Read JSON file and parse it
	readJsonFile: async (filePath: string): Promise<any> => {
		const result = await ipcRenderer.invoke('fs:readJsonFile', filePath);
		if (result.success) {
			return result.data;
		} else {
			throw new Error(result.error);
		}
	},

	// Open external URL
	openExternal: async (url: string): Promise<void> => {
		const result = await ipcRenderer.invoke('shell:openExternal', url);
		if (!result.success) {
			throw new Error(result.error);
		}
	},

	// Call BoomyBuilder via Edge.js
	callBoomyBuilder: async (buildRequest: any): Promise<any> => {
		const result = await ipcRenderer.invoke(
			'edge:callBoomyBuilder',
			buildRequest
		);

		return result;
	},

	// Convert OGG to MOGG using makemogg.exe (Windows only)
	convertToMogg: async (
		audioPath: string
	): Promise<{
		inputPath: string;
		outputPath: string;
		output: string;
	}> => {
		const result = await ipcRenderer.invoke(
			'audio:convertToMogg',
			audioPath
		);
		if (result.success) {
			return result.data;
		} else {
			throw new Error(result.error);
		}
	},
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type definitions for the renderer process
export type ElectronAPI = typeof electronAPI;
