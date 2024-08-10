import { DatabasesTypes } from '@myroslavshymon/orm';
import { DatabaseIngotInterface, DatabaseManagerInterface, TriggerInterface } from '@myroslavshymon/orm/dist/orm/core';

export class TriggerManager {
	public static async initManage<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
	): Promise<[string, string]> {
		let createTriggerMigrationQuery = '';
		let undoTriggerMigrationQuery = '';

		for (const trigger of currentDatabaseIngot.triggers) {
			createTriggerMigrationQuery += await databaseManager.triggerManager.createTrigger(trigger as TriggerInterface<DT>, true);

			if (databaseType === DatabasesTypes.POSTGRES) {
				undoTriggerMigrationQuery += await (databaseManager as DatabaseManagerInterface<DatabasesTypes.POSTGRES>)
					.triggerManager
					.dropTrigger({
						triggerName: trigger.name,
						tableName: trigger.tableName
					}, true);
			} else if (databaseType === DatabasesTypes.MYSQL) {
				undoTriggerMigrationQuery += await (databaseManager as DatabaseManagerInterface<DatabasesTypes.MYSQL>)
					.triggerManager
					.dropTrigger({
						triggerName: trigger.name
					}, true);
			}
		}

		return [createTriggerMigrationQuery, undoTriggerMigrationQuery];
	}

	public static async manage<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
	): Promise<[string, string]> {
		let migrationQuery = '';
		let undoMigrationQuery = '';

		migrationQuery += await this._handleTriggerAdding<DT>(currentDatabaseIngot, lastDatabaseIngot, databaseManager);
		undoMigrationQuery += await this._handleTriggerRemoving<DT>(lastDatabaseIngot, currentDatabaseIngot, databaseManager, databaseType);

		migrationQuery += await this._handleTriggerRemoving<DT>(currentDatabaseIngot, lastDatabaseIngot, databaseManager, databaseType);
		undoMigrationQuery += await this._handleTriggerAdding<DT>(lastDatabaseIngot, currentDatabaseIngot, databaseManager);

		return [migrationQuery, undoMigrationQuery];
	}

	private static async _handleTriggerAdding<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>
	): Promise<string> {
		let createTriggerQuery = '';

		const newTriggers = currentDatabaseIngot.triggers.filter(currentTrigger =>
			!lastDatabaseIngot.triggers
				.some(lastTrigger => lastTrigger.id === currentTrigger.id)
		);

		for (const newTrigger of newTriggers) {
			createTriggerQuery += await databaseManager.triggerManager.createTrigger(newTrigger as TriggerInterface<DT>, true);
		}

		return createTriggerQuery;
	}

	private static async _handleTriggerRemoving<DT extends DatabasesTypes>(
		currentDatabaseIngot: DatabaseIngotInterface<DT>,
		lastDatabaseIngot: DatabaseIngotInterface<DT>,
		databaseManager: DatabaseManagerInterface<DT>,
		databaseType: DatabasesTypes
	): Promise<string> {
		let dropTriggerQuery = '';

		const removedTriggers = lastDatabaseIngot.triggers.filter(lastTrigger =>
			!currentDatabaseIngot.triggers
				.some(currentTrigger => currentTrigger.id === lastTrigger.id)
		);

		for (const removedTrigger of removedTriggers) {
			if (databaseType === DatabasesTypes.POSTGRES) {
				dropTriggerQuery += await (databaseManager as DatabaseManagerInterface<DatabasesTypes.POSTGRES>)
					.triggerManager
					.dropTrigger({
						triggerName: removedTrigger.name,
						tableName: removedTrigger.tableName
					}, true);
			}

			if (databaseType === DatabasesTypes.MYSQL) {
				dropTriggerQuery += await (databaseManager as DatabaseManagerInterface<DatabasesTypes.MYSQL>)
					.triggerManager
					.dropTrigger({
						triggerName: removedTrigger.name
					}, true);
			}
		}

		return dropTriggerQuery;
	}
}