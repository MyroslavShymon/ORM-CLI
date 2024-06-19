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
	OneToManyRelationsOfDatabaseIngotInterface,
	OneToOneRelationsOfDatabaseIngotInterface
} from './interfaces';
import { TableIngotInterface } from '@myroslavshymon/orm/orm/core/interfaces/table-ingot.interface';
import { DataSourceInterface } from '@myroslavshymon/orm/orm/core/interfaces/data-source.interface';

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

		if (!migrationQuery) {
			console.error('There is no changes to make migration.\n Please restart your app!');
			throw new Error('There is no changes to make migration.\n Please restart your app!');
		}

		return migrationQuery;
	}

	async _handleManyToManyRelationsOfTable(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledManyToManyRelation = '';
		let mismatchedLastTableManyToManyRelations: ManyToManyInterface[] = [];

		const findManyToManyMatches = (tables: TableIngotInterface<DataSourceInterface>[]): void => {
			const manyToManyRelations: ManyToManyInterface[] = [];
			for (const table of tables) {
				if (table.manyToMany.length) {
					for (const manyToMany of table.manyToMany) {
						manyToManyRelations.push(manyToMany);
					}
				}
			}

			// // Знайти елементи, які мають відповідники
			//  manyToManyRelations.filter(relation => {
			// 	return manyToManyRelations.some(otherRelation =>
			// 		relation.referencedTable === otherRelation.tableName &&
			// 		otherRelation.referencedTable === relation.tableName
			// 	);
			// });

			const elementsWithoutMatchingReferences = manyToManyRelations.filter(relation => {
				return !manyToManyRelations.some(otherRelation =>
					relation.referencedTable === otherRelation.tableName &&
					otherRelation.referencedTable === relation.tableName
				);
			});

			if (elementsWithoutMatchingReferences.length > 0) {
				throw new Error('You must write many to many decorator in another table to make relation correct!');
			}

		};

		findManyToManyMatches(currentDatabaseIngot.tables);

		for (const currentTableIngot of currentDatabaseIngot.tables) {
			for (const lastTableIngot of lastDatabaseIngot.tables) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const currentManyToManySet = new Set(currentTableIngot.manyToMany.map(rel => JSON.stringify(rel)));
					const lastManyToManySet = new Set(lastTableIngot.manyToMany.map(rel => JSON.stringify(rel)));

					for (const currentTableManyToManyRelations of currentTableIngot.manyToMany) {
						if (!lastManyToManySet.has(JSON.stringify(currentTableManyToManyRelations))) {
							queryWithHandledManyToManyRelation += this._databaseManager.tableCreator
								.generateCreateTableQueryForManyToManyRelation([{
									tableName: currentTableIngot.name,
									manyToManyRelation: currentTableIngot.manyToMany
								}]) + '\n\t\t\t\t';
							console.log('queryWithHandledManyToManyRelation', queryWithHandledManyToManyRelation);
						}
					}

					for (const lastTableManyToManyRelation of lastTableIngot.manyToMany) {
						if (!currentManyToManySet.has(JSON.stringify(lastTableManyToManyRelation))) {
							mismatchedLastTableManyToManyRelations.push(lastTableManyToManyRelation);
						}
					}
				}
			}
		}

		const uniquePairs = new Set<string>();

		mismatchedLastTableManyToManyRelations.forEach(relation => {
			const pair1 = `${relation.tableName}_${relation.referencedTable}`;
			const pair2 = `${relation.referencedTable}_${relation.tableName}`;

			if (!uniquePairs.has(pair2)) {
				uniquePairs.add(pair1);
			}
		});
		console.log('Array.from(uniquePairs)', Array.from(uniquePairs));

		for (const tableName of Array.from(uniquePairs)) {
			queryWithHandledManyToManyRelation += await this._databaseManager.tableManipulation
				.alterTable(tableName, true)
				.dropTable({ type: 'CASCADE' }) + '\n\t\t\t\t';
		}
		return queryWithHandledManyToManyRelation;
	}

	async _handleOneToManyRelationsOfTable(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledOneToManyRelation = '';

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

	async _handleOneToOneRelationsOfTable(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface
	): Promise<string> {
		let queryWithHandledOneToOneRelation = '';

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

	async _handleRenameOfColumn(
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

	async _handleColumnCheckConstraintChange(
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

	async _handleColumnUniqueChange(
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

	async _handleColumnNotNullChange(
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

	async _handleColumnDataTypeChange(
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

	async _handleColumnDefaultValue(
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