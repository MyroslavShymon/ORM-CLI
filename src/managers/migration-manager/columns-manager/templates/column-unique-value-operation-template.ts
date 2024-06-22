import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { CompressedTableIngotInterface } from '../../../common';

export abstract class ColumnUniqueValueOperationTemplate {
	private readonly _databaseManager: DatabaseManagerInterface<DatabasesTypes>;

	protected constructor(
		databaseManager: DatabaseManagerInterface<DatabasesTypes>
	) {
		this._databaseManager = databaseManager;
	}

	protected async _handleColumnUniqueChange(
		currentTableIngotList: CompressedTableIngotInterface[],
		lastTableIngotList: CompressedTableIngotInterface[]
	): Promise<string> {
		let queryWithHandledUnique = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
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
						} else {
							queryWithHandledUnique += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.addUniqueToColumn({ columnName: columnWithChangedUnique.name }
								) + '\n\t\t\t\t';
						}
					}
				}
			}
		}

		return queryWithHandledUnique;
	}
}