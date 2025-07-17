// Electron API type definitions for renderer process

export interface ElectronAPI {
	// Read file content as string
	readFile: (filePath: string) => Promise<string>;

	// Read file content as buffer
	readFileBuffer: (filePath: string) => Promise<Buffer>;

	// Select file(s) with dialog
	selectFilePath: (options?: {
		multiple?: boolean;
		fileTypes?: Array<{ name: string; extensions: string[] }>;
		title?: string;
	}) => Promise<string | string[] | null>;

	// Select directory/directories with dialog
	selectDirectoryPath: (options?: {
		multiple?: boolean;
		title?: string;
	}) => Promise<string | string[] | null>;

	// Select path (file or directory) with custom options
	selectPath: (options: {
		type: 'file' | 'directory' | 'both';
		multiple?: boolean;
		fileTypes?: Array<{ name: string; extensions: string[] }>;
		title?: string;
	}) => Promise<string | string[] | null>;

	// Check if path exists
	pathExists: (path: string) => Promise<boolean>;

	// Get file stats
	getFileStats: (path: string) => Promise<{
		isFile: boolean;
		isDirectory: boolean;
		size: number;
		modified: Date;
		created: Date;
	}>;

	// Write file content
	writeFile: (filePath: string, content: string) => Promise<void>;

	// Delete file
	deleteFile: (filePath: string) => Promise<void>;

	// Create directory
	createDirectory: (dirPath: string) => Promise<void>;

	// Read directory contents
	readDirectory: (dirPath: string) => Promise<
		Array<{
			name: string;
			isFile: boolean;
			isDirectory: boolean;
		}>
	>;

	// Read JSON file and parse it
	readJsonFile: (filePath: string) => Promise<any>;

	// Open external URL
	openExternal: (url: string) => Promise<void>;

	// Call BoomyBuilder via Edge.js
	callBoomyBuilder: (buildRequest: any) => Promise<any>;

	// Convert OGG to MOGG using makemogg.exe (Windows only)
	convertToMogg: (audioPath: string) => Promise<{
		inputPath: string;
		outputPath: string;
		output: string;
	}>;
}

declare global {
	interface Window {
		electronAPI: ElectronAPI;
	}
}
