import path from 'path';
import fs from 'fs';
import prompts from 'prompts';
import { DatabaseIngotInterface, DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import * as tsNode from 'ts-node';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionData, convertToCamelCase, createDirectoryIfNotExists, MigrationManagerInterface } from '../common';
import { DatabaseContextInterface } from '../strategy';
import { TrimmedTableInfoInterface } from './interfaces';
import { DatabasesTypes } from '@myroslavshymon/orm';

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

		if (currentDatabaseIngot.tables.length === 0) {
			throw new Error(
				'There is no tables for create migration.\n' +
				'Please create entities and pass it into models array when init ORM'
			);
		}

		currentDatabaseIngot = await this._addIdToCurrentDatabaseIngot(currentDatabaseIngot);

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

	async _addIdToCurrentDatabaseIngot(currentDatabaseIngot: DatabaseIngotInterface): Promise<DatabaseIngotInterface> {
		console.log('111111111111111111111', currentDatabaseIngot);
		for (const currentTable of currentDatabaseIngot.tables) {
			if (currentTable.id === undefined) {
				currentTable.id = uuidv4();
			}
			if (currentTable.columns)
				for (const column of currentTable.columns) {
					if (column.id === undefined)

						column.id = uuidv4();
				}
			if (currentTable.computedColumns)
				for (const computedColumns of currentTable.computedColumns) {
					if (computedColumns.id === undefined)
						computedColumns.id = uuidv4();
				}
		}
		console.log('2222222222222222', currentDatabaseIngot);

		await this._databaseContext.updateMigrationIngot({
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema,
			ingot: currentDatabaseIngot
		});

		return currentDatabaseIngot;
	}

	//TODO не заюуваємо шо в нас ще будуть трігери процедури і так далі
	private async _createMigrationQuery(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface,
		isMigrationsExist: boolean
	): Promise<string> {
		if (!isMigrationsExist) {
			const a = this._databaseManager.tableCreator.generateCreateTableQuery(currentDatabaseIngot.tables);
			console.log('aaaaaaaaaaaaaaaaaaaaaaaaaaa', a);
			return a;
		}

		let migrationQuery = '';

		if (currentDatabaseIngot.tables && lastDatabaseIngot.tables) {
			migrationQuery += await this._generateDropTableQuery(currentDatabaseIngot, lastDatabaseIngot);
		}
		console.log('shooooooooooooooooooooooooooooooo', migrationQuery);
		return migrationQuery;
		// let createTableQuery = '';
		// const newColumns = this.findNewColumns(currentDatabaseIngot, lastDatabaseIngot);
		// const deletedColumns = this.findDeletedColumns(currentDatabaseIngot, lastDatabaseIngot);
		// console.log('sdfsdfs', this.addDefaultValue(currentDatabaseIngot, lastDatabaseIngot));


		// for (const { tableName, columnName } of deletedColumns) {
		// 	const deleteColumnQuery = await this._databaseManager.tableManipulation.alterTable(tableName, true).deleteColumn({
		// 		columnName,
		// 		isCascade: true
		// 	});
		// 	createTableQuery += deleteColumnQuery + '\n\n';
		// }
		//
		// for (const { tableName, column } of newColumns) {
		// 	const newColumnQuery = await this._databaseManager.tableManipulation.alterTable(tableName, true).addColumn({
		// 		columnName: column.name,
		// 		options: column.options
		// 	});
		// 	createTableQuery += newColumnQuery + '\n\n';
		// }

		// return createTableQuery;
	}

	private async _generateDropTableQuery(currentDatabaseIngot: DatabaseIngotInterface, lastDatabaseIngot: DatabaseIngotInterface) {
		let migrationQuery = '';

		const deletedTablesNames = this._detectDeletedTables(currentDatabaseIngot, lastDatabaseIngot);
		console.log('deletedTables', deletedTablesNames);

		if (deletedTablesNames.length > 0) {
			for (const tableName of deletedTablesNames) {
				migrationQuery += await this._databaseManager.tableManipulation
					.alterTable(tableName, true)
					.dropTable({
						type: 'RESTRICT'
					}) + '\n';
			}
		}

		console.log('migrationQuerymigrationQuerymigrationQuerymigrationQuery', typeof migrationQuery, migrationQuery);

		return migrationQuery;
	}

	private _detectDeletedTables(
		currentDatabase: DatabaseIngotInterface,
		lastDatabase: DatabaseIngotInterface
	): string[] {
		const deletedTables: string[] = [];
		const currentTables: TrimmedTableInfoInterface[] = currentDatabase.tables!.map(table => ({
			id: table.id,
			name: table.name
		}));
		const lastTables: TrimmedTableInfoInterface[] = lastDatabase.tables!.map(table => ({
			id: table.id,
			name: table.name
		}));

		console.log('currentTables', currentTables);
		console.log('lastTables', lastTables);

		lastTables.forEach((lastTable) => {
			const table = currentTables.find((currentTable) => currentTable.id === lastTable.id);
			console.log('tabletabletabletabletabletable', table);
			if (!table) {
				deletedTables.push(lastTable.name);
			}
		});

		return deletedTables;
	}

	// findDeletedColumns(
	// 	currentDatabase: DatabaseIngotInterface,
	// 	lastDatabase: DatabaseIngotInterface
	// ): { tableName: string; columnName: string }[] {
	// 	const deletedColumns: { tableName: string; columnName: string }[] = [];
	//
	// 	currentDatabase.tables && currentDatabase.tables.forEach((currentTable) => {
	// 		const tableName = currentTable.name;
	// 		const lastTable = lastDatabase.tables && lastDatabase.tables.find((t) => t.name === tableName);
	//
	// 		if (lastTable) {
	// 			const currentColumns = currentTable.columns.reduce((acc, col) => {
	// 				acc[col.name] = col;
	// 				return acc;
	// 			}, {} as Record<string, any>);
	// 			const lastColumns = lastTable.columns.reduce((acc, col) => {
	// 				acc[col.name] = col;
	// 				return acc;
	// 			}, {} as Record<string, any>);
	//
	// 			Object.keys(lastColumns).forEach((columnName) => {
	// 				if (!(columnName in currentColumns)) {
	// 					deletedColumns.push({
	// 						tableName: tableName,
	// 						columnName: columnName
	// 					});
	// 				}
	// 			});
	// 		}
	// 	});
	//
	// 	return deletedColumns;
	// }
	//
	// findNewColumns(currentDatabase: any, lastDatabase: any) {
	// 	const newColumns: any[] = [];
	//
	// 	currentDatabase.tables.forEach((currentTable: any) => {
	// 		const tableName: any = currentTable.name;
	// 		const lastTable: any = lastDatabase.tables.find((t: any) => t.name === tableName);
	//
	// 		if (lastTable) {
	// 			const currentColumns: any = currentTable.columns.reduce((acc: any, col: any) => {
	// 				acc[col.name] = col;
	// 				return acc;
	// 			}, {});
	// 			const lastColumns: any = lastTable.columns.reduce((acc: any, col: any) => {
	// 				acc[col.name] = col;
	// 				return acc;
	// 			}, {});
	//
	// 			Object.keys(currentColumns).forEach((columnName) => {
	// 				if (!(columnName in lastColumns)) {
	// 					newColumns.push({
	// 						tableName: tableName,
	// 						column: currentColumns[columnName]
	// 					});
	// 				}
	// 			});
	// 		}
	// 	});
	//
	// 	return newColumns;
	// }
	//
	//
	// addDefaultValue(
	// 	currentDatabase: DatabaseIngotInterface,
	// 	lastDatabase: DatabaseIngotInterface
	// ) {
	// 	const tableChanges: { tableName: string, parameters: AddDefaultValueInterface }[] = [];
	//
	// 	if (!currentDatabase.tables)
	//
	// 		lastDatabase.tables && lastDatabase.tables.forEach(lastDatabaseTable => {
	// 			const currentDatabaseTable = currentDatabase.tables &&
	// 				currentDatabase.tables.find(
	// 					currentDatabaseTable => lastDatabaseTable.id === currentDatabaseTable.id);
	//
	// 			if (!currentDatabaseTable) return;
	//
	// 			lastDatabaseTable.columns.forEach(lastDatabaseColumn => {
	// 					const currentDatabaseColumn = currentDatabaseTable?.columns.find(currentDatabaseColumn => lastDatabaseColumn.id === currentDatabaseColumn.id);
	// 					if (
	// 						currentDatabaseColumn &&
	// 						lastDatabaseColumn.options?.defaultValue !== currentDatabaseColumn.options?.defaultValue
	// 					) {
	// 						tableChanges.push({
	// 							tableName: lastDatabaseTable.name,
	// 							parameters: {
	// 								columnName: lastDatabaseColumn.name,
	// 								value: lastDatabaseColumn.options.defaultValue
	// 							}
	// 						});
	// 					}
	// 				}
	// 			);
	//
	// 		});
	//
	// 	return tableChanges;
	// };

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