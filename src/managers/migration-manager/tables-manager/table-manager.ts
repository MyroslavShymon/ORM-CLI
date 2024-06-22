import { DatabaseIngotInterface, DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class TableManager {
	public static async manage(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface,
		databaseManager: DatabaseManagerInterface<DatabasesTypes>
	): Promise<[string, string]> {
		let migrationQuery = '';
		let undoMigrationQuery = '';

		migrationQuery += await this._handleRenameOfTables(currentDatabaseIngot, lastDatabaseIngot, databaseManager);
		undoMigrationQuery += await this._handleRenameOfTables(lastDatabaseIngot, currentDatabaseIngot, databaseManager);

		migrationQuery += await this._handleTableAdding(currentDatabaseIngot, lastDatabaseIngot, databaseManager);
		undoMigrationQuery += await this._handleTableRemoving(lastDatabaseIngot, currentDatabaseIngot, databaseManager);

		migrationQuery += await this._handleTableRemoving(currentDatabaseIngot, lastDatabaseIngot, databaseManager);
		undoMigrationQuery += await this._handleTableAdding(lastDatabaseIngot, currentDatabaseIngot, databaseManager);

		return [migrationQuery, undoMigrationQuery];
	}

	private static async _handleRenameOfTables(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface,
		databaseManager: DatabaseManagerInterface<DatabasesTypes>
	): Promise<string> {
		let queryWithHandledRenamedTables = '';

		for (const currentTable of currentDatabaseIngot.tables) {
			for (const lastTable of lastDatabaseIngot.tables) {
				if (
					lastTable.id === currentTable.id &&
					lastTable.name !== currentTable.name
				) {
					queryWithHandledRenamedTables += await databaseManager.tableManipulation
						.alterTable(lastTable.name, true)
						.renameTable({ tableName: currentTable.name }) + '\n\t\t\t\t';
				}
			}
		}

		return queryWithHandledRenamedTables;
	}

	private static async _handleTableAdding(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface,
		databaseManager: DatabaseManagerInterface<DatabasesTypes>
	): Promise<string> {
		const newTables = currentDatabaseIngot.tables.filter(currentTable =>
			!lastDatabaseIngot.tables
				.some(lastTable => lastTable.id === currentTable.id)
		);

		return databaseManager.tableCreator.generateCreateTableQuery(newTables);
	}

	private static async _handleTableRemoving(
		currentDatabaseIngot: DatabaseIngotInterface,
		lastDatabaseIngot: DatabaseIngotInterface,
		databaseManager: DatabaseManagerInterface<DatabasesTypes>
	): Promise<string> {
		let queryWithHandledRemovingTables = '';

		const removedTables = lastDatabaseIngot.tables.filter(lastTable =>
			!currentDatabaseIngot.tables
				.some(currentTable => currentTable.id === lastTable.id)
		);

		for (const deletedTable of removedTables) {
			queryWithHandledRemovingTables += await databaseManager.tableManipulation
				.alterTable(deletedTable.name, true)
				.dropTable({ type: 'CASCADE' }) + '\n\t\t\t\t';
		}

		return queryWithHandledRemovingTables;
	}
}