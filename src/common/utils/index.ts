import fs from 'fs';

export function createDirectoryIfNotExists(directoryPath: string, directoryName: string) {
	if (!fs.existsSync(directoryPath)) {
		fs.mkdirSync(directoryPath);
		console.log(`Created ${directoryName} folder.`);
	}
}

export function convertToCamelCase(input: string): string {
	const parts = input.split(/[-_]+/);

	const camelCaseParts = parts.map((part, index) => {
		if (index === 0) {
			return part;
		} else {
			return part.charAt(0).toUpperCase() + part.slice(1);
		}
	});

	return camelCaseParts.join('');
}