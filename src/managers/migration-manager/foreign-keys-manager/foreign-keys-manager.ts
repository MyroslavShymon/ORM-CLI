import { DatabaseIngotInterface, DatabaseManagerInterface, ManyToManyInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { TableIngotInterface } from '@myroslavshymon/orm/orm/core/interfaces/table-ingot.interface';
import {
	MatchedManyToManyRelationsInterface,
	OneToManyRelationsOfDatabaseIngotInterface,
	OneToOneRelationsOfDatabaseIngotInterface
} from '../../common';

export class ForeignKeysManager {
	public static async manage<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
	): Promise<[string, string]> {
		let migrationQuery = '';
		let undoMigrationQuery = '';

		migrationQuery += await this._handleManyToManyRelationsOfTable<DT>(currentDatabaseIngot, lastDatabaseIngot, databaseManager, databaseType);
		undoMigrationQuery += await this._handleManyToManyRelationsOfTable<DT>(lastDatabaseIngot, currentDatabaseIngot, databaseManager, databaseType);

		migrationQuery += await this._handleOneToManyRelationsOfTable<DT>(currentDatabaseIngot, lastDatabaseIngot, databaseManager);
		undoMigrationQuery += await this._handleOneToManyRelationsOfTable<DT>(lastDatabaseIngot, currentDatabaseIngot, databaseManager);

		migrationQuery += await this._handleOneToOneRelationsOfTable<DT>(currentDatabaseIngot, lastDatabaseIngot, databaseManager);
		undoMigrationQuery += await this._handleOneToOneRelationsOfTable<DT>(lastDatabaseIngot, currentDatabaseIngot, databaseManager);

		return [migrationQuery, undoMigrationQuery];
	}

	private static _validateManyToManyRelations<DT extends DatabasesTypes>(tables: TableIngotInterface<DT>[]): void {
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

	private static _getManyToManyMatches<DT extends DatabasesTypes>(tables: TableIngotInterface<DT>[]): MatchedManyToManyRelationsInterface[] {
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

	private static async _handleManyToManyRelationsOfTable<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
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
			queryWithHandledManyToManyRelation += await databaseManager.tableManipulation
				.alterTable(tableName, true)
				.dropTable({ type: 'CASCADE' } as any) + '\n\t\t\t\t';
		}

		const groupedRelations: { [key: string]: ManyToManyInterface[] } = {};

		for (const relation of addedRelations) {
			if (!groupedRelations[relation.futureTableName]) {
				groupedRelations[relation.futureTableName] = [];
			}
			groupedRelations[relation.futureTableName].push(relation);
		}

		const tableIngots: TableIngotInterface<DatabasesTypes>[] = Object.keys(groupedRelations).map(futureTableName => {
			const relations = groupedRelations[futureTableName];
			return {
				name: futureTableName,
				options: { primaryKeys: relations.map(relation => relation.foreignKey) },
				columns: relations.map(relation => ({ name: relation.foreignKey, options: { dataType: 'NUMERIC' } })),
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
			queryWithHandledManyToManyRelation += databaseManager.tableCreator.generateCreateTableQuery([tableIngot as TableIngotInterface<DT>]) + '\n\t\t\t\t';
		}

		return queryWithHandledManyToManyRelation;
	}

	private static _checkOneToManyRelations<DT extends DatabasesTypes>(databaseIngot: DatabaseIngotInterface<DT>): void {
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

	private static async _handleOneToManyRelationsOfTable<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>
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
							queryWithHandledOneToManyRelation += await databaseManager.tableManipulation
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
							queryWithHandledOneToManyRelation += await databaseManager.tableManipulation
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

	private static _checkOneToOneRelations<DT extends DatabasesTypes>(databaseIngot: DatabaseIngotInterface<DT>): void {
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

	private static async _handleOneToOneRelationsOfTable<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>
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
							queryWithHandledOneToOneRelation += await databaseManager.tableManipulation
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
							queryWithHandledOneToOneRelation += await databaseManager.tableManipulation
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
}