import path from 'path';
import fs from 'fs';
import prompts from 'prompts';
import {
	ConnectionData,
	createDirectoryIfNotExists,
	DatabaseContextInterface,
	MigrationManagerInterface
} from '../common';


export class MigrationManager implements MigrationManagerInterface {
	_connectionData: ConnectionData;
	_databaseContext: DatabaseContextInterface;

	constructor(databaseContext: DatabaseContextInterface, connectionData: ConnectionData) {
		this._connectionData = connectionData;
		this._databaseContext = databaseContext;
	}

	async createMigration(migrationName: string | boolean): Promise<void> {
		const projectRoot = process.cwd();
		const migrationPath = path.resolve(projectRoot, 'migrations');

		await this._handleMigrationFolderCreation(migrationPath);
		migrationName = await this._generateMigrationName(migrationPath, migrationName);
		await this._handleMigrationCreation(migrationPath, migrationName);
	}

	private async _handleMigrationFolderCreation(migrationPath: string) {
		const isMigrationFolderExist = fs.existsSync(migrationPath);
		await this._databaseContext.connect(this._connectionData);

		if (!isMigrationFolderExist) {
			console.error(`Folder ${migrationPath} doesn't exist.`);
			await this._promptToAddMigrationFolder(migrationPath);
			return;
		}
	}

	private async _promptToAddMigrationFolder(migrationPath: string) {
		let addMigrationFolder = true;

		while (addMigrationFolder) {
			const userInput = await prompts([
				{
					type: 'toggle',
					name: 'addMigrationFolder',
					message: 'Do you want to add a migration folder?',
					initial: true,
					active: 'yes',
					inactive: 'no'
				}
			]);

			if (userInput.addMigrationFolder) {
				createDirectoryIfNotExists(migrationPath, 'migrations');
				addMigrationFolder = false; // Exit the loop if the user agrees
			} else {
				console.log('A migration folder is required for migrations. Please agree to create one.');
			}
		}
	}

	private async _generateMigrationName(
		migrationPath: string,
		migrationName: string | boolean
	): Promise<string> {
		const isMigrationsExist = fs.readdirSync(migrationPath).length !== 0;
		//migrationName === true --- means that there is no name in the migration
		if (!isMigrationsExist && migrationName === true) {
			const userInput = await prompts([
				{
					type: 'toggle',
					name: 'migrationName',
					message: `Do you want to name initial migration 'init'?`,
					initial: true,
					active: 'yes',
					inactive: 'no'
				}
			]);
			return userInput.migrationName ? (Date.now() + '_' + 'init') : await this._promptMigrationName();
		}

		return migrationName === true ? await this._promptMigrationName() : (Date.now() + '_' + (migrationName as string));
	}

	private async _promptMigrationName(): Promise<string> {
		const userInput = await prompts({
			type: 'text',
			name: 'migrationName',
			message: 'Enter migration name'
		});
		return Date.now() + '_' + userInput.migrationName;
	}

	private async _handleMigrationCreation(migrationPath: string, migrationName: string) {
		await this._createMigrationInDatabase(migrationName);
		this._createMigrationFile(migrationPath, migrationName);
		console.log(`Migration created at ${migrationPath}`);
		return;
	}

	private async _createMigrationInDatabase(migrationName: string) {
		const databaseIngot = await this._databaseContext.getCurrentDatabaseIngot({
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});

		await this._databaseContext.createMigration({
			migrationName,
			databaseIngot,
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});
	}

	private _createMigrationFile(migrationPath: string, migrationName: string) {
		const exampleMigrationPath = path.resolve(migrationPath, `${migrationName}.migration.ts`);
		const exampleMigrationContent = `console.log('try 2')`;

		fs.writeFileSync(exampleMigrationPath, exampleMigrationContent);
	}
}