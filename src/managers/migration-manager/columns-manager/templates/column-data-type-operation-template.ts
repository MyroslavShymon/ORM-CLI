import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { CompressedTableIngotInterface } from '../../../common';

export abstract class ColumnDataTypeOperationTemplate {
	private readonly _databaseManager: DatabaseManagerInterface<DatabasesTypes>;

	protected constructor(
		databaseManager: DatabaseManagerInterface<DatabasesTypes>
	) {
		this._databaseManager = databaseManager;
	}

	protected async _handleColumnDataTypeChange(
		currentTableIngotList: CompressedTableIngotInterface[],
		lastTableIngotList: CompressedTableIngotInterface[]
	): Promise<string> {
		let queryWithHandledDataType = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
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

}