import path from 'path';
import fs from 'fs';
import prompts from 'prompts';
import {
	ColumnInterface,
	DatabaseIngotInterface,
	DatabaseManagerInterface,
	ManyToManyInterface
} from '@myroslavshymon/orm/orm/core';
import * as tsNode from 'ts-node';
import { ConnectionData, convertToCamelCase, createDirectoryIfNotExists, MigrationManagerInterface } from '../common';
import { DatabaseContextInterface } from '../strategy';
import { DatabasesTypes } from '@myroslavshymon/orm';
import {
	ColumnOfDatabaseIngotInterface,
	MatchedManyToManyRelationsInterface,
	OneToManyRelationsOfDatabaseIngotInterface,
	OneToOneRelationsOfDatabaseIngotInterface
} from './interfaces';
import { TableIngotInterface } from '@myroslavshymon/orm/orm/core/interfaces/table-ingot.interface';
import { DataSourceInterface } from '@myroslavshymon/orm/orm/core/interfaces/data-source.interface';
import { DataSourcePostgres } from '@myroslavshymon/orm/orm/strategies/postgres';

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

		const migrationQuery = await this._createMigrationQuery(currentDatabaseIngot, lastDatabaseIngot, isMigrationsExist);
		this._createMigrationFile(migrationPath, migrationName, migrationQuery);

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
	): Promise<string> {
		if (!isMigrationsExist) {
			return this._databaseManager.tableCreator.generateCreateTableQuery(currentDatabaseIngot.tables);
		}

		let migrationQuery = '';

		migrationQuery += await this._handleColumnAdding(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleColumnDeleting(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleColumnDefaultValue(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleColumnDataTypeChange(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleColumnNotNullChange(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleColumnUniqueChange(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleColumnCheckConstraintChange(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleRenameOfColumn(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleOneToOneRelationsOfTable(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleOneToManyRelationsOfTable(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleManyToManyRelationsOfTable(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleTableAdding(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleTableRemoving(currentDatabaseIngot, lastDatabaseIngot);
		migrationQuery += await this._handleRenameOfTables(currentDatabaseIngot, lastDatabaseIngot);

		if (!migrationQuery) {
			console.error('There is no changes to make migration.\n Please restart your app!');
			throw new Error('There is no changes to make migration.\n Please restart your app!');
		}

		return migrationQuery;
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

	private async _handleRenameOfColumn(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledRenameOfColumn = '';

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
					const columnsWhoseNameHasChanged = currentTableIngot.columns.reduce(
						(acc: any[], currentColumn) => {
							const lastColumn = lastTableIngot.columns
								.find(lastColumn => lastColumn.id === currentColumn.id);

							if (lastColumn && currentColumn.name !== lastColumn.name) {
								acc.push({
									...currentColumn,
									futureColumnName: currentColumn.name,
									columnName: lastColumn.name
								});
							}
							return acc;
						}, []);

					for (const { columnName, futureColumnName } of columnsWhoseNameHasChanged) {
						queryWithHandledRenameOfColumn += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.renameColumn(
								{ columnName, futureColumnName }
							) + '\n\t\t\t\t';
					}
				}
			}
		}

		return queryWithHandledRenameOfColumn;
	}

	private async _handleColumnCheckConstraintChange(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledCheckConstraint = '';

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
					const columnsWithChangedCheckConstraint = currentTableIngot.columns.filter(
						currentColumn => lastTableIngot.columns.some(
							lastColumn =>
								currentColumn.id === lastColumn.id &&
								(
									lastColumn.options?.check !== currentColumn.options?.check ||
									lastColumn.options?.nameOfCheckConstraint !== currentColumn.options?.nameOfCheckConstraint
								)
						)
					);

					for (const columnWithChangedCheckConstraint of columnsWithChangedCheckConstraint) {
						if (!columnWithChangedCheckConstraint.options?.check) {
							queryWithHandledCheckConstraint += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.deleteCheckConstraintOfColumn(
									{ columnName: columnWithChangedCheckConstraint.name }
								) + '\n\t\t\t\t';
							continue;
						}


						queryWithHandledCheckConstraint += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.addCheckConstraintToColumn(
								{
									columnName: columnWithChangedCheckConstraint.name,
									check: String(columnWithChangedCheckConstraint.options?.check),
									nameOfCheckConstraint: columnWithChangedCheckConstraint.options?.nameOfCheckConstraint
								}
							) + '\n\t\t\t\t';
					}
				}
			}
		}

		return queryWithHandledCheckConstraint;
	}

	private async _handleColumnUniqueChange(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledUnique = '';

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
					const columnsWithChangedUnique = currentTableIngot.columns.filter(
						currentColumn => lastTableIngot.columns.some(
							lastColumn =>
								currentColumn.id === lastColumn.id &&
								lastColumn.options?.unique !== currentColumn.options?.unique
						)
					);

					for (const columnWithChangedUnique of columnsWithChangedUnique) {
						if (!columnWithChangedUnique.options?.unique) {
							queryWithHandledUnique += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.deleteUniqueFromColumn({ columnName: columnWithChangedUnique.name }
								) + '\n\t\t\t\t';
							continue;
						}

						queryWithHandledUnique += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.addUniqueToColumn({ columnName: columnWithChangedUnique.name }
							) + '\n\t\t\t\t';
					}
				}
			}
		}

		return queryWithHandledUnique;
	}

	private async _handleColumnNotNullChange(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledNotNull = '';

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
					const columnsWithChangedNotNull = currentTableIngot.columns.filter(
						currentColumn => lastTableIngot.columns.some(
							lastColumn =>
								currentColumn.id === lastColumn.id &&
								lastColumn.options?.nullable !== currentColumn.options?.nullable
						)
					);

					for (const columnWithChangedNotNull of columnsWithChangedNotNull) {
						if (!columnWithChangedNotNull.options?.nullable) {
							queryWithHandledNotNull += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.addNotNullToColumn({ columnName: columnWithChangedNotNull.name }
								) + '\n\t\t\t\t';
							continue;
						}

						queryWithHandledNotNull += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.dropNotNullFromColumn({ columnName: columnWithChangedNotNull.name }
							) + '\n\t\t\t\t';
					}
				}
			}
		}

		return queryWithHandledNotNull;
	}

	private async _handleColumnDataTypeChange(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledDataType = '';

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
					const columnsWithChangedDataType = currentTableIngot.columns.filter(
						currentColumn => lastTableIngot.columns.some(
							lastColumn =>
								currentColumn.id === lastColumn.id &&
								(
									lastColumn.options?.dataType !== currentColumn.options?.dataType ||
									lastColumn.options?.length !== currentColumn.options?.length
								)
						)
					);

					for (const columnWithChangedDataType of columnsWithChangedDataType) {
						if (columnWithChangedDataType.options?.dataType) {
							queryWithHandledDataType += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.changeDataTypeOfColumn(
									{
										columnName: columnWithChangedDataType.name,
										dataType: columnWithChangedDataType.options.dataType,
										length: columnWithChangedDataType.options.length ?
											String(columnWithChangedDataType.options.length) : undefined
									}
								) + '\n\t\t\t\t';
						}
					}
				}
			}
		}

		return queryWithHandledDataType;
	}

	private async _handleColumnDefaultValue(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledDefaultValue = '';

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
							queryWithHandledDefaultValue += await this._databaseManager.tableManipulation
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
						queryWithHandledDefaultValue += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.dropDefaultValue({ columnName: columnWithDeletedDefaultValue.name }) + '\n\t\t\t\t';
					}
				}
			}
		}

		return queryWithHandledDefaultValue;
	}

	private async _handleColumnDeleting(
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

	private async _handleColumnAdding(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let addedColumnsQuery = '';

		const columnOfCurrentDatabaseIngot: ColumnOfDatabaseIngotInterface[] = currentDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns,
			primaryColumn: table.primaryColumn
		}));

		const columnOfLastDatabaseIngot: ColumnOfDatabaseIngotInterface[] = lastDatabaseIngot.tables.map(table => ({
			id: table?.id,
			name: table.name,
			columns: table.columns,
			primaryColumn: table.primaryColumn
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

					if (currentTableIngot.primaryColumn && !lastTableIngot.primaryColumn) {
						addedColumnsQuery += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.addPrimaryGeneratedColumn({
								columnName: currentTableIngot.primaryColumn.columnName,
								type: currentTableIngot.primaryColumn.type
							}) + '\n\t\t\t\t';
					}

					if (!currentTableIngot.primaryColumn && lastTableIngot.primaryColumn) {
						addedColumnsQuery += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.deleteColumn({
								columnName: lastTableIngot.primaryColumn.columnName
							}) + '\n\t\t\t\t';
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