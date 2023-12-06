import path from 'path';
import fs from 'fs';
import prompts from 'prompts';
import {
	ConnectionData,
	convertToCamelCase,
	createDirectoryIfNotExists,
	DatabaseContextInterface,
	MigrationManagerInterface
} from '../common';
import { DatabaseManager, DatabasesTypes, DataSourceContext } from '@myroslavshymon/orm';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';


export class MigrationManager implements MigrationManagerInterface {
	_connectionData: ConnectionData;
	_databaseContext: DatabaseContextInterface;
	_databaseType: DatabasesTypes;

	constructor(databaseContext: DatabaseContextInterface, connectionData: ConnectionData, databaseType: DatabasesTypes) {
		this._connectionData = connectionData;
		this._databaseContext = databaseContext;
		this._databaseType = databaseType;
	}

	async createMigration(migrationName: string | boolean): Promise<void> {
		const projectRoot = process.cwd();
		const migrationPath = path.resolve(projectRoot, 'migrations');

		await this._handleMigrationFolderCreation(migrationPath);

		const isMigrationsExist = fs.readdirSync(migrationPath).length !== 0;

		migrationName = await this._generateMigrationName(migrationName, isMigrationsExist);
		await this._handleMigrationCreation(migrationPath, migrationName, isMigrationsExist);
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
		migrationName: string | boolean,
		isMigrationsExist: boolean
	): Promise<string> {
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

	private async _handleMigrationCreation(
		migrationPath: string,
		migrationName: string,
		isMigrationsExist: boolean
	) {
		const databaseIngot = await this._createMigrationInDatabase(migrationName);
		const migrationQuery = this._createMigrationQuery(databaseIngot, isMigrationsExist);
		this._createMigrationFile(migrationPath, migrationName, migrationQuery);
		console.log(`Migration created at ${migrationPath}`);
		return;
	}

	private async _createMigrationInDatabase(migrationName: string): Promise<DatabaseIngotInterface> {
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

		return databaseIngot;
	}

	private _createMigrationFile(migrationPath: string, migrationName: string, migrationQuery: string) {
		migrationPath = path.resolve(migrationPath, `${migrationName}.migration.ts`);
		migrationName = convertToCamelCase(migrationName.split('_').slice(1).join(''));

		const migrationContent = `import {DatabaseManagerInterface, MigrationInterface} from "@myroslavshymon/orm/orm/core";

export class ${migrationName} implements MigrationInterface {
    async down(databaseManager: DatabaseManagerInterface): Promise<void> {
        await databaseManager.query(
            \`${migrationQuery}\`
        );
    }

   async up(databaseManager: DatabaseManagerInterface): Promise<void> {
       await databaseManager.query(
           \`${migrationQuery}\`
       );
    }
}`;
		fs.writeFileSync(migrationPath, migrationContent);
	}

	private _createMigrationQuery(databaseIngot: DatabaseIngotInterface, isMigrationsExist: boolean): string {
		let createTableQuery;
		const databaseManager = new DatabaseManager({ type: this._databaseType }, new DataSourceContext());

		if (!databaseIngot.tables) {
			throw new Error('There is no tables to create');
		}

		if (!isMigrationsExist) {
			createTableQuery = databaseManager.tableCreator.generateCreateTableQuery(databaseIngot.tables);
			return createTableQuery;
		}

		return 'console.log(\'in future\')';
	}
}