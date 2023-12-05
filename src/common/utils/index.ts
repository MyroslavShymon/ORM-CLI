import fs from 'fs';

export function createDirectoryIfNotExists(directoryPath: string, directoryName: string) {
	if (!fs.existsSync(directoryPath)) {
		fs.mkdirSync(directoryPath);
		console.log(`Created ${directoryName} folder.`);
	}
}