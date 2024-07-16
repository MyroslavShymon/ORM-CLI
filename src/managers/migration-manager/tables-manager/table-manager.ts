import { DatabaseIngotInterface, DatabaseManagerInterface, DropTableInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class TableManager {
	public static async manage<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
	): Promise<[string, string]> {
		let migrationQuery = '';
		let undoMigrationQuery = '';

		migrationQuery += await this._handleRenameOfTables<DT>(currentDatabaseIngot, lastDatabaseIngot, databaseManager);
		undoMigrationQuery += await this._handleRenameOfTables<DT>(lastDatabaseIngot, currentDatabaseIngot, databaseManager);

		migrationQuery += await this._handleTableAdding<DT>(currentDatabaseIngot, lastDatabaseIngot, databaseManager);
		undoMigrationQuery += await this._handleTableRemoving<DT>(lastDatabaseIngot, currentDatabaseIngot, databaseManager, databaseType);

		migrationQuery += await this._handleTableRemoving<DT>(currentDatabaseIngot, lastDatabaseIngot, databaseManager, databaseType);
		undoMigrationQuery += await this._handleTableAdding<DT>(lastDatabaseIngot, currentDatabaseIngot, databaseManager);

		return [migrationQuery, undoMigrationQuery];
	}

	private static async _handleRenameOfTables<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>
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

	private static async _handleTableAdding<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>
	): Promise<string> {
		const newTables = currentDatabaseIngot.tables.filter(currentTable =>
			!lastDatabaseIngot.tables
				.some(lastTable => lastTable.id === currentTable.id)
		);

		return databaseManager.tableCreator.generateCreateTableQuery(newTables);
	}

	private static async _handleTableRemoving<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
	): Promise<string> {
		let queryWithHandledRemovingTables = '';

		const removedTables = lastDatabaseIngot.tables.filter(lastTable =>
			!currentDatabaseIngot.tables
				.some(currentTable => currentTable.id === lastTable.id)
		);

		for (const deletedTable of removedTables) {
			let dropTableOptions: DropTableInterface<DT>;

			if (databaseType === DatabasesTypes.POSTGRES) {
				dropTableOptions = { type: 'CASCADE' } as DropTableInterface<DT>;
			} else if (databaseType === DatabasesTypes.MYSQL) {
				dropTableOptions = {} as DropTableInterface<DT>;
			} else {
				throw new Error(`Unsupported database type: ${databaseType}`);
			}

			queryWithHandledRemovingTables += await databaseManager.tableManipulation
				.alterTable(deletedTable.name, true)
				.dropTable(dropTableOptions) + '\n\t\t\t\t';
		}

		return queryWithHandledRemovingTables;
	}
}