import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { CompressedTableIngotInterface } from '../../common';

export abstract class ColumnNotNullOperationTemplate {
	private readonly _databaseManager: DatabaseManagerInterface<DatabasesTypes>;

	protected constructor(
		databaseManager: DatabaseManagerInterface<DatabasesTypes>
	) {
		this._databaseManager = databaseManager;
	}

	protected async _handleColumnNotNullChange(
		currentTableIngotList: CompressedTableIngotInterface[],
		lastTableIngotList: CompressedTableIngotInterface[]
	): Promise<string> {
		let queryWithHandledNotNull = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
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
						} else {
							queryWithHandledNotNull += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.dropNotNullFromColumn({ columnName: columnWithChangedNotNull.name }
								) + '\n\t\t\t\t';
						}
					}
				}
			}
		}

		return queryWithHandledNotNull;
	}

}