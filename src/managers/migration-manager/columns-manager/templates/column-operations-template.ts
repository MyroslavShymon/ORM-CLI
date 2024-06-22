import { ColumnInterface, DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { CompressedTableIngotInterface } from '../../../common/interfaces';
import { DatabasesTypes } from '@myroslavshymon/orm';

export abstract class ColumnOperationsTemplate {
	private readonly _databaseManager: DatabaseManagerInterface<DatabasesTypes>;

	protected constructor(
		databaseManager: DatabaseManagerInterface<DatabasesTypes>
	) {
		this._databaseManager = databaseManager;
	}

	protected async _handleColumnDeleting(
		currentTableIngotList: CompressedTableIngotInterface[],
		lastTableIngotList: CompressedTableIngotInterface[]
	): Promise<string> {
		let deleteColumnsQuery = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
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

	protected async _handleColumnAdding(
		currentTableIngotList: CompressedTableIngotInterface[],
		lastTableIngotList: CompressedTableIngotInterface[]
	): Promise<string> {
		let addedColumnsQuery = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
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
}