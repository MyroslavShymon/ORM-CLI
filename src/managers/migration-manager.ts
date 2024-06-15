import path from 'path';
import fs from 'fs';
import prompts from 'prompts';
import { ColumnInterface, DatabaseIngotInterface, DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import * as tsNode from 'ts-node';
import { ConnectionData, convertToCamelCase, createDirectoryIfNotExists, MigrationManagerInterface } from '../common';
import { DatabaseContextInterface } from '../strategy';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { ColumnOfDatabaseIngotInterface } from './interfaces';

export class MigrationManager implements MigrationManagerInterface {
	_projectRoot = process.cwd();
	_connectionData: ConnectionData;
	_databaseContext: DatabaseContextInterface;
	_databaseManager: DatabaseManagerInterface<DatabasesTypes>;

	constructor(
		databaseContext: DatabaseContextInterface,
		connectionData: ConnectionData,
		databaseManager: DatabaseManagerInterface<DatabasesTypes>
	) {
		this._connectionData = connectionData;
		this._databaseContext = databaseContext;
		this._databaseManager = databaseManager;
	}

	async migrationUp(migrationName: string): Promise<void> {
		await this._prepareMigration();
		const filePath = path.resolve(this._projectRoot, `migrations`, migrationName);
		const migrationClassName = this._extractMigrationClassName(migrationName);

		await this._runMigration(filePath, migrationClassName);
		await this._updateMigrationStatus(migrationName, true);

	}

	async migrate(migrationName: string) {
		await this._prepareMigration();
		const migrationPath = path.resolve(this._projectRoot, `migrations`);
		const migrationFiles = fs.readdirSync(migrationPath).filter(file => file.endsWith('.migration.ts'));

		for (const file of migrationFiles) {
			const filePath = path.join(migrationPath, file);
			const migrationClassName = this._extractMigrationClassName(migrationName);

			await this._runMigration(filePath, migrationClassName);
			await this._updateMigrationStatus(migrationName, true);
		}
	}

	private async _prepareMigration(): Promise<void> {
		await this._databaseManager.connectDatabase();
		await this._databaseContext.connect(this._connectionData);
	}

	private _extractMigrationClassName(migrationName: string): string {
		return convertToCamelCase(
			migrationName
				.split('_')
				.slice(1)
				.join('')
				.split('.migration.ts')[0]
		);
	}

	private async _runMigration(filePath: string, migrationClassName: string) {
		tsNode.register();
		const module = require(filePath);
		const MigrationClass = module[migrationClassName];

		const migrationClass = new MigrationClass();
		await migrationClass.up(this._databaseManager);
	}

	private async _updateMigrationStatus(migrationName: string, isUp: boolean): Promise<void> {
		await this._databaseContext.updateMigrationStatus({
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema,
			migrationName: migrationName.split('.migration.ts')[0],
			isUp
		});
	}

	/////////Create migration/////////

	async createMigration(migrationName: string | boolean): Promise<void> {
		const migrationPath = path.resolve(this._projectRoot, 'migrations');

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
		if (userInput.migrationName === undefined || userInput.migrationName === '') {
			throw new Error('You specified an incorrect migration name');
		}
		return Date.now() + '_' + userInput.migrationName;
	}

	private async _handleMigrationCreation(
		migrationPath: string,
		migrationName: string,
		isMigrationsExist: boolean
	) {
		await this._databaseContext.checkTableExistence({
			tableName: this._connectionData.migrationTable,
			schema: this._connectionData.migrationTableSchema
		});
		let currentDatabaseIngot: DatabaseIngotInterface = await this._databaseContext.getCurrentDatabaseIngot({
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});

		const lastDatabaseIngot: DatabaseIngotInterface = await this._databaseContext.getLastDatabaseIngot({
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});

		await this._databaseContext.createMigration({
			migrationName,
			databaseIngot: currentDatabaseIngot,
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});
		const migrationQuery = await this._createMigrationQuery(currentDatabaseIngot, lastDatabaseIngot, isMigrationsExist);
		this._createMigrationFile(migrationPath, migrationName, migrationQuery);
		console.log(`Migration created at ${migrationPath}`);
		return;
	}


	//TODO не заюуваємо шо в нас ще будуть трігери процедури і так далі
	private async _createMigrationQuery(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface,
		isMigrationsExist: boolean
	): Promise<string> {
		if (!isMigrationsExist) {
			return this._databaseManager.tableCreator.generateCreateTableQuery(currentDatabaseIngot.tables);
		}

		let migrationQuery = '';
		migrationQuery += await this._handleColumnAdding(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleColumnDeleting(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleColumnDefaultValue(currentDatabaseIngot, lastDatabaseIngot);


		if (!migrationQuery) {
			console.error('There is no changes to make migration');
			throw new Error('There is no changes to make migration');
		}

		return migrationQuery;
	}

	async _handleColumnDefaultValue(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let defaultValueQuery = '';

		const columnOfCurrentDatabaseIngot: ColumnOfDatabaseIngotInterface[] = currentDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns
		}));

		const columnOfLastDatabaseIngot: ColumnOfDatabaseIngotInterface[] = lastDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns
		}));


		for (const currentTableIngot of columnOfCurrentDatabaseIngot) {
			for (const lastTableIngot of columnOfLastDatabaseIngot) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const columnsWithChangedDefaultValue =
						currentTableIngot.columns
							.filter(currentColumn =>
								lastTableIngot.columns
									.some(lastColumn =>
										currentColumn.id === lastColumn.id &&
										currentColumn.options?.defaultValue !== lastColumn.options?.defaultValue &&
										currentColumn.options?.defaultValue
									)
							);

					for (const columnWithChangedDefaultValue of columnsWithChangedDefaultValue) {
						if (columnWithChangedDefaultValue.options?.defaultValue) {
							defaultValueQuery += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.addDefaultValue(
									{
										columnName: columnWithChangedDefaultValue.name,
										value: columnWithChangedDefaultValue.options.defaultValue
									}
								) + '\n\t\t\t\t';
						}
					}

					const columnsWithDeletedDefaultValue =
						currentTableIngot.columns
							.filter(currentColumn =>
								lastTableIngot.columns
									.some(lastColumn =>
										currentColumn.id === lastColumn.id &&
										!currentColumn.options?.defaultValue &&
										lastColumn.options?.defaultValue
									)
							);


					for (const columnWithDeletedDefaultValue of columnsWithDeletedDefaultValue) {
						defaultValueQuery += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.dropDefaultValue({ columnName: columnWithDeletedDefaultValue.name }) + '\n\t\t\t\t';
					}
				}
			}
		}

		return defaultValueQuery;
	}

	async _handleColumnDeleting(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let deleteColumnsQuery = '';

		const columnOfCurrentDatabaseIngot: ColumnOfDatabaseIngotInterface[] = currentDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns
		}));

		const columnOfLastDatabaseIngot: ColumnOfDatabaseIngotInterface[] = lastDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns
		}));

		for (const currentTableIngot of columnOfCurrentDatabaseIngot) {
			for (const lastTableIngot of columnOfLastDatabaseIngot) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const deletedColumns: ColumnInterface[] = lastTableIngot.columns
						.filter(
							lastColumn => !currentTableIngot.columns
								.some(currentColumn => currentColumn.id === lastColumn.id)
						);

					for (const deletedColumn of deletedColumns) {
						deleteColumnsQuery += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.deleteColumn({ columnName: deletedColumn.name }) + '\n\t\t\t\t';
					}
				}
			}
		}

		return deleteColumnsQuery;
	}

	async _handleColumnAdding(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let addedColumnsQuery = '';

		const columnOfCurrentDatabaseIngot: ColumnOfDatabaseIngotInterface[] = currentDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns
		}));

		const columnOfLastDatabaseIngot: ColumnOfDatabaseIngotInterface[] = lastDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns
		}));

		for (const currentTableIngot of columnOfCurrentDatabaseIngot) {
			for (const lastTableIngot of columnOfLastDatabaseIngot) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const addedColumns: ColumnInterface[] = currentTableIngot.columns
						.filter(
							currentColumn => !lastTableIngot.columns
								.some(lastColumn => lastColumn.id === currentColumn.id)
						);

					for (const addedColumn of addedColumns) {
						addedColumnsQuery += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.addColumn({ columnName: addedColumn.name, options: addedColumn.options }) + '\n\t\t\t\t';
					}
				}
			}
		}

		return addedColumnsQuery;
	}

	private _createMigrationFile(migrationPath: string, migrationName: string, migrationQuery: string) {
		migrationPath = path.resolve(migrationPath, `${migrationName}.migration.ts`);
		migrationName = convertToCamelCase(migrationName.split('_').slice(1).join(''));

		const migrationContent = `import {DatabaseManagerInterface, MigrationInterface} from "@myroslavshymon/orm/orm/core";

export class ${migrationName} implements MigrationInterface {
    async up(databaseManager: DatabaseManagerInterface): Promise<void> {
        await databaseManager.query(
            \`${migrationQuery}\`
        );
    }

   async down(databaseManager: DatabaseManagerInterface): Promise<void> {
       await databaseManager.query(
           'SELECT * from public.migrations'
       );
    }
}`;
		fs.writeFileSync(migrationPath, migrationContent);
	}
}