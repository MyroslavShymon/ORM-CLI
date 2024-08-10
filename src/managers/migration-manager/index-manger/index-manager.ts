import { DatabasesTypes } from '@myroslavshymon/orm';
import { DatabaseIngotInterface, DatabaseManagerInterface, IndexInterface } from '@myroslavshymon/orm/dist/orm/core';

export class IndexManager {
	public static async initManage<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
	): Promise<[string, string]> {
		let createIndexMigrationQuery = '';
		let undoIndexMigrationQuery = '';

		for (const index of currentDatabaseIngot.indexes) {
			createIndexMigrationQuery += await databaseManager.indexManager.createIndex(index as IndexInterface<DT>, true);

			if (databaseType === DatabasesTypes.POSTGRES) {
				undoIndexMigrationQuery += await (databaseManager as DatabaseManagerInterface<DatabasesTypes.POSTGRES>)
					.indexManager
					.dropIndex({
						indexName: index.indexName
					}, true);
			} else if (databaseType === DatabasesTypes.MYSQL) {
				if (!index.tableName) {
					throw new Error('Missing table name');
				}
				undoIndexMigrationQuery += await (databaseManager as DatabaseManagerInterface<DatabasesTypes.MYSQL>)
					.indexManager
					.dropIndex({
						indexName: index.indexName,
						tableName: index.tableName
					}, true);
			}
		}

		return [createIndexMigrationQuery, undoIndexMigrationQuery];
	}

	public static async manage<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
	): Promise<[string, string]> {
		let migrationQuery = '';
		let undoMigrationQuery = '';

		migrationQuery += await this._handleIndexAdding<DT>(currentDatabaseIngot, lastDatabaseIngot, databaseManager);
		undoMigrationQuery += await this._handleIndexRemoving<DT>(lastDatabaseIngot, currentDatabaseIngot, databaseManager, databaseType);

		migrationQuery += await this._handleIndexRemoving<DT>(currentDatabaseIngot, lastDatabaseIngot, databaseManager, databaseType);
		undoMigrationQuery += await this._handleIndexAdding<DT>(lastDatabaseIngot, currentDatabaseIngot, databaseManager);

		return [migrationQuery, undoMigrationQuery];
	}

	private static async _handleIndexAdding<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>
	): Promise<string> {
		let createIndexQuery = '';

		const newIndexes = currentDatabaseIngot.indexes.filter(currentIndex =>
			!lastDatabaseIngot.indexes
				.some(lastIndex => lastIndex.id === currentIndex.id)
		);

		for (const newIndex of newIndexes) {
			createIndexQuery += await databaseManager.indexManager.createIndex(newIndex as IndexInterface<DT>, true);
		}

		return createIndexQuery;
	}

	private static async _handleIndexRemoving<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
	): Promise<string> {
		let dropIndexQuery = '';

		const removedIndexes = lastDatabaseIngot.indexes.filter(lastIndex =>
			!currentDatabaseIngot.indexes
				.some(currentIndex => currentIndex.id === lastIndex.id)
		);

		for (const removedIndex of removedIndexes) {
			if (databaseType === DatabasesTypes.POSTGRES) {
				dropIndexQuery += await (databaseManager as DatabaseManagerInterface<DatabasesTypes.POSTGRES>)
					.indexManager
					.dropIndex({
						indexName: removedIndex.indexName
					}, true);
			}

			if (databaseType === DatabasesTypes.MYSQL) {
				if (!removedIndex.tableName) {
					throw new Error('Missing table name');
				}
				dropIndexQuery += await (databaseManager as DatabaseManagerInterface<DatabasesTypes.MYSQL>)
					.indexManager
					.dropIndex({
						indexName: removedIndex.indexName,
						tableName: removedIndex.tableName
					}, true);
			}
		}

		return dropIndexQuery;
	}
}