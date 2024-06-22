import path from 'path';
import fs from 'fs';
import prompts from 'prompts';
import * as tsNode from 'ts-node';
import { ConnectionData, convertToCamelCase, createDirectoryIfNotExists, MigrationManagerInterface } from '../common';
import { DatabaseContextInterface } from '../strategy';
import { DatabasesTypes } from '@myroslavshymon/orm';
import {
	CommandClass,
	CompressedTableIngotInterface,
	MatchedManyToManyRelationsInterface,
	MigrationQueriesInterface,
	OneToManyRelationsOfDatabaseIngotInterface,
	OneToOneRelationsOfDatabaseIngotInterface,
	OperationClass
} from './common';
import { TableIngotInterface } from '@myroslavshymon/orm/orm/core/interfaces/table-ingot.interface';
import { DataSourceInterface } from '@myroslavshymon/orm/orm/core/interfaces/data-source.interface';
import { DataSourcePostgres } from '@myroslavshymon/orm/orm/strategies/postgres';
import { DatabaseIngotInterface, DatabaseManagerInterface, ManyToManyInterface } from '@myroslavshymon/orm/orm/core';
import {
	AddColumnCommand,
	AddColumnOperation,
	AddDefaultValueCommand,
	AddDefaultValueToColumnOperation,
	ChangeCheckConstraintCommand,
	ChangeCheckConstraintOfColumnOperation,
	ChangeDataTypeCommand,
	ChangeDataTypeOfColumnOperation,
	ChangeNotNullCommand,
	ChangeNotNullOfColumnOperation,
	ChangeUniqueCommand,
	ChangeUniqueValueOfColumnOperation,
	DeleteColumnCommand,
	DeleteColumnOperation,
	DeleteDefaultValueCommand,
	DeleteDefaultValueFromColumnOperation,
	MigrationCommandInterface,
	MigrationInvoker,
	OperationInterface,
	RenameColumnCommand,
	RenameOfColumnOperation
} from './commands';

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
		if (typeof migrationName === 'string') {
			const migrationsByName = await this._databaseContext.getMigrationByName({
				migrationName: migrationName,
				migrationTableSchema: this._connectionData.migrationTableSchema,
				migrationTable: this._connectionData.migrationTable
			});
			if (migrationsByName.length) {
				throw Error(`Migrations with name '${migrationName}' already exist`);
			}
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

		const migrationQueries = await this._createMigrationQuery(currentDatabaseIngot, lastDatabaseIngot, isMigrationsExist);
		this._createMigrationFile(migrationPath, migrationName, migrationQueries.migrationQuery, migrationQueries.undoMigrationQuery);

		await this._databaseContext.createMigration({
			migrationName,
			databaseIngot: currentDatabaseIngot,
			migrationTable: this._connectionData.migrationTable,
			migrationTableSchema: this._connectionData.migrationTableSchema
		});
		console.log(`Migration created at ${migrationPath}`);
		return;
	}


	//TODO не заюуваємо шо в нас ще будуть трігери процедури і так далі
	private async _createMigrationQuery(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface,
		isMigrationsExist: boolean
	): Promise<MigrationQueriesInterface> {
		let migrationQuery = '';
		let undoMigrationQuery = '';
		// if (!isMigrationsExist) {
		// 	return this._databaseManager.tableCreator.generateCreateTableQuery(currentDatabaseIngot.tables);
		// }

		const currentCompressedTables: CompressedTableIngotInterface[] = currentDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns
		}));

		const lastCompressedTables: CompressedTableIngotInterface[] = lastDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns
		}));

		const invoker = new MigrationInvoker();

		const executeOperation = async <O extends OperationInterface, C extends MigrationCommandInterface>
		(operationClass: OperationClass<O>, commandClass: CommandClass<O, C>) => {
			const operation = new operationClass(this._databaseManager, currentCompressedTables, lastCompressedTables);
			const command = new commandClass(operation);
			migrationQuery += await invoker.executeCommand(command);
			undoMigrationQuery += await invoker.undoCommand();
		};

		await executeOperation<AddColumnOperation, AddColumnCommand>(AddColumnOperation, AddColumnCommand);
		await executeOperation<DeleteColumnOperation, DeleteColumnCommand>(DeleteColumnOperation, DeleteColumnCommand);
		await executeOperation<AddDefaultValueToColumnOperation, AddDefaultValueCommand>(AddDefaultValueToColumnOperation, AddDefaultValueCommand);
		await executeOperation<DeleteDefaultValueFromColumnOperation, DeleteDefaultValueCommand>(DeleteDefaultValueFromColumnOperation, DeleteDefaultValueCommand);
		await executeOperation<ChangeDataTypeOfColumnOperation, ChangeDataTypeCommand>(ChangeDataTypeOfColumnOperation, ChangeDataTypeCommand);
		await executeOperation<ChangeNotNullOfColumnOperation, ChangeNotNullCommand>(ChangeNotNullOfColumnOperation, ChangeNotNullCommand);
		await executeOperation<ChangeUniqueValueOfColumnOperation, ChangeUniqueCommand>(ChangeUniqueValueOfColumnOperation, ChangeUniqueCommand);
		await executeOperation<ChangeCheckConstraintOfColumnOperation, ChangeCheckConstraintCommand>(ChangeCheckConstraintOfColumnOperation, ChangeCheckConstraintCommand);
		await executeOperation<RenameOfColumnOperation, RenameColumnCommand>(RenameOfColumnOperation, RenameColumnCommand);

		migrationQuery += await this._handleOneToOneRelationsOfTable(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleOneToManyRelationsOfTable(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleManyToManyRelationsOfTable(currentDatabaseIngot, lastDatabaseIngot);

		migrationQuery += await this._handleTableAdding(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleTableRemoving(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleRenameOfTables(currentDatabaseIngot, lastDatabaseIngot);

		// || !undoMigrationQuery
		if (!migrationQuery) {
			console.error('There is no changes to make migration.\n Please restart your app!');
			throw new Error('There is no changes to make migration.\n Please restart your app!');
		}

		return { migrationQuery, undoMigrationQuery };
	}

	private async _handleRenameOfTables(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledRenamedTables = '';

		for (const currentTable of currentDatabaseIngot.tables) {
			for (const lastTable of lastDatabaseIngot.tables) {
				if (
					lastTable.id === currentTable.id &&
					lastTable.name !== currentTable.name
				) {
					queryWithHandledRenamedTables += await this._databaseManager.tableManipulation
						.alterTable(lastTable.name, true)
						.renameTable({ tableName: currentTable.name }) + '\n\t\t\t\t';
				}
			}
		}

		return queryWithHandledRenamedTables;
	}

	private async _handleTableAdding(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		const newTables = currentDatabaseIngot.tables.filter(currentTable =>
			!lastDatabaseIngot.tables
				.some(lastTable => lastTable.id === currentTable.id)
		);

		return this._databaseManager.tableCreator.generateCreateTableQuery(newTables);
	}

	private async _handleTableRemoving(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledRemovingTables = '';

		const removedTables = lastDatabaseIngot.tables.filter(lastTable =>
			!currentDatabaseIngot.tables
				.some(currentTable => currentTable.id === lastTable.id)
		);

		for (const deletedTable of removedTables) {
			queryWithHandledRemovingTables += await this._databaseManager.tableManipulation
				.alterTable(deletedTable.name, true)
				.dropTable({ type: 'CASCADE' }) + '\n\t\t\t\t';
		}

		return queryWithHandledRemovingTables;
	}

	private _validateManyToManyRelations(tables: TableIngotInterface<DataSourceInterface>[]): void {
		const manyToManyRelations = tables.flatMap(table => table.manyToMany);

		const findUnmatchedRelations = (relations: ManyToManyInterface[]): ManyToManyInterface[] => {
			return relations.filter(relation =>
				!relations.some(otherRelation =>
					relation.referencedTable === otherRelation.tableName &&
					otherRelation.referencedTable === relation.tableName
				)
			);
		};

		const unmatchedRelations = findUnmatchedRelations(manyToManyRelations);

		if (unmatchedRelations.length > 0) {
			throw new Error('You must write many to many decorator in another table to make relation correct!');
		}
	};

	private _getManyToManyMatches(tables: TableIngotInterface<DataSourceInterface>[]): MatchedManyToManyRelationsInterface[] {
		const manyToManyRelations = tables.flatMap(table => table.manyToMany);

		const matchedRelations = manyToManyRelations.filter(relation =>
			manyToManyRelations.some(otherRelation =>
				relation.referencedTable === otherRelation.tableName &&
				otherRelation.referencedTable === relation.tableName
			)
		);

		const uniquePairs = new Set<string>();
		const newRelations: MatchedManyToManyRelationsInterface[] = [];

		matchedRelations.forEach(relation => {
			const pair1 = `${relation.tableName}_${relation.referencedTable}`;
			const pair2 = `${relation.referencedTable}_${relation.tableName}`;

			if (!uniquePairs.has(pair2)) {
				uniquePairs.add(pair1);
				newRelations.push({ ...relation, futureTableName: pair1 });
			} else {
				newRelations.push({ ...relation, futureTableName: pair2 });
			}
		});

		return newRelations;
	};

	async _handleManyToManyRelationsOfTable(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledManyToManyRelation = '';

		this._validateManyToManyRelations(currentDatabaseIngot.tables);

		const currentRelations = this._getManyToManyMatches(currentDatabaseIngot.tables);
		const lastRelations = this._getManyToManyMatches(lastDatabaseIngot.tables);

		const currentRelationsSet = new Set(currentRelations.map(relation => JSON.stringify(relation)));
		const lastRelationsSet = new Set(lastRelations.map(relation => JSON.stringify(relation)));

		const addedRelations = currentRelations.filter(relation => !lastRelationsSet.has(JSON.stringify(relation)));

		const tableNamesOfRemovedRelations: string[] = Array.from(
			new Set(lastRelations
				.filter(relation => !currentRelationsSet.has(JSON.stringify(relation)))
				.map(removedRelation => removedRelation.futureTableName)
			));

		for (const tableName of tableNamesOfRemovedRelations) {
			queryWithHandledManyToManyRelation += await this._databaseManager.tableManipulation
				.alterTable(tableName, true)
				.dropTable({ type: 'CASCADE' }) + '\n\t\t\t\t';
		}

		const groupedRelations: { [key: string]: ManyToManyInterface[] } = {};

		for (const relation of addedRelations) {
			if (!groupedRelations[relation.futureTableName]) {
				groupedRelations[relation.futureTableName] = [];
			}
			groupedRelations[relation.futureTableName].push(relation);
		}

		const tableIngots: TableIngotInterface<DataSourcePostgres>[] = Object.keys(groupedRelations).map(futureTableName => {
			const relations = groupedRelations[futureTableName];
			return {
				name: futureTableName,
				options: { primaryKeys: relations.map(relation => relation.foreignKey) },
				columns: relations.map(relation => ({ name: relation.foreignKey, options: { dataType: 'INT' } })),
				computedColumns: [],
				foreignKeys: relations.map(relation => ({
					key: relation.referencedColumn,
					table: relation.referencedTable,
					columnName: relation.foreignKey
				})),
				primaryColumn: { columnName: 'id', type: 'BIGINT' },
				oneToOne: [],
				oneToMany: [],
				manyToMany: []
			};
		});

		for (const tableIngot of tableIngots) {
			queryWithHandledManyToManyRelation += this._databaseManager.tableCreator.generateCreateTableQuery([tableIngot]) + '\n\t\t\t\t';
		}

		return queryWithHandledManyToManyRelation;
	}

	private _checkOneToManyRelations(databaseIngot: DatabaseIngotInterface): void {
		const { tables } = databaseIngot;

		tables.forEach(table => {
			table.oneToMany.forEach(otm => {
				const columnForeignKey = table.columns.find(column => column.name === otm.foreignKey);
				if (!columnForeignKey) {
					throw Error(`There is no foreign key '${otm.foreignKey}' in table '${otm.tableName}'.`);
				}

				const correspondingTable = tables.find(t => t.name === otm.tableName);
				if (!correspondingTable) {
					throw new Error(`Table '${otm.tableName}' referenced in OneToMany relation not found.`);
				}

				if (correspondingTable.primaryColumn.columnName !== otm.referenceColumn) {
					throw new Error(`Reference column '${otm.referenceColumn}' in OneToMany relation does not match primary column '${correspondingTable.primaryColumn.columnName}' in table '${otm.tableName}'.`);
				}
			});
		});
	}

	async _handleOneToManyRelationsOfTable(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledOneToManyRelation = '';
		this._checkOneToManyRelations(currentDatabaseIngot);

		const oneToManyRelationsOfCurrentDatabaseIngot: OneToManyRelationsOfDatabaseIngotInterface[] = currentDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			oneToMany: table.oneToMany
		}));

		const oneToManyRelationsOfLastDatabaseIngot: OneToManyRelationsOfDatabaseIngotInterface[] = lastDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			oneToMany: table.oneToMany
		}));


		for (const currentTableIngot of oneToManyRelationsOfCurrentDatabaseIngot) {
			for (const lastTableIngot of oneToManyRelationsOfLastDatabaseIngot) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const currentOneToManySet = new Set(currentTableIngot.oneToMany.map(rel => JSON.stringify(rel)));
					const lastOneToManySet = new Set(lastTableIngot.oneToMany.map(rel => JSON.stringify(rel)));

					for (const currentTableOneToManyRelations of currentTableIngot.oneToMany) {
						if (!lastOneToManySet.has(JSON.stringify(currentTableOneToManyRelations))) {
							queryWithHandledOneToManyRelation += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.addForeignKey(
									{
										foreignKey: currentTableOneToManyRelations.foreignKey,
										referencedColumn: currentTableOneToManyRelations.referenceColumn,
										referencedTable: currentTableOneToManyRelations.tableName
									}
								) + '\n\t\t\t\t';
						}
					}

					for (const lastTableOneToManyRelations of lastTableIngot.oneToMany) {
						if (!currentOneToManySet.has(JSON.stringify(lastTableOneToManyRelations))) {
							queryWithHandledOneToManyRelation += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.dropConstraint({
									constraintName: `fk_${currentTableIngot.name}_${lastTableOneToManyRelations.tableName}`
								}) + '\n\t\t\t\t';
						}
					}
				}
			}
		}

		return queryWithHandledOneToManyRelation;
	}

	private _checkOneToOneRelations(databaseIngot: DatabaseIngotInterface): void {
		const { tables } = databaseIngot;

		tables.forEach(table => {
			table.oneToOne.forEach(oto => {
				const columnForeignKey = table.columns.find(column => column.name === oto.foreignKey);
				if (!columnForeignKey) {
					throw Error(`There is no foreign key '${oto.foreignKey}' in table '${oto.table}'.`);
				}

				const correspondingTable = tables.find(t => t.name === oto.table);
				if (!correspondingTable) {
					throw new Error(`Table '${oto.table}' referenced in OneToOne relation not found.`);
				}

				if (correspondingTable.primaryColumn.columnName !== oto.referenceColumn) {
					throw new Error(`Reference column '${oto.referenceColumn}' in OneToOne relation does not match primary column '${correspondingTable.primaryColumn.columnName}' in table '${oto.table}'.`);
				}
			});
		});
	}

	private async _handleOneToOneRelationsOfTable(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledOneToOneRelation = '';
		this._checkOneToOneRelations(currentDatabaseIngot);

		const oneToOneRelationsOfCurrentDatabaseIngot: OneToOneRelationsOfDatabaseIngotInterface[] = currentDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			oneToOne: table.oneToOne
		}));

		const oneToOneRelationsOfLastDatabaseIngot: OneToOneRelationsOfDatabaseIngotInterface[] = lastDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			oneToOne: table.oneToOne
		}));


		for (const currentTableIngot of oneToOneRelationsOfCurrentDatabaseIngot) {
			for (const lastTableIngot of oneToOneRelationsOfLastDatabaseIngot) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const currentOneToOneSet = new Set(currentTableIngot.oneToOne.map(rel => JSON.stringify(rel)));
					const lastOneToOneSet = new Set(lastTableIngot.oneToOne.map(rel => JSON.stringify(rel)));

					for (const currentTableOneToOneRelations of currentTableIngot.oneToOne) {
						if (!lastOneToOneSet.has(JSON.stringify(currentTableOneToOneRelations))) {
							queryWithHandledOneToOneRelation += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.addForeignKey({
									foreignKey: currentTableOneToOneRelations.foreignKey,
									referencedColumn: currentTableOneToOneRelations.referenceColumn,
									referencedTable: currentTableOneToOneRelations.table
								}) + '\n\t\t\t\t';
						}
					}

					for (const lastTableOneToOneRelations of lastTableIngot.oneToOne) {
						if (!currentOneToOneSet.has(JSON.stringify(lastTableOneToOneRelations))) {
							queryWithHandledOneToOneRelation += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.dropConstraint({
									constraintName: `fk_${currentTableIngot.name}_${lastTableOneToOneRelations.table}`
								}) + '\n\t\t\t\t';
						}
					}
				}
			}
		}

		return queryWithHandledOneToOneRelation;
	}

	private _createMigrationFile(migrationPath: string, migrationName: string, migrationQuery: string, undoMigrationQuery: string) {
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
             \`${undoMigrationQuery}\`
       );
    }
}`;
		fs.writeFileSync(migrationPath, migrationContent);
	}
}