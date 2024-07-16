import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { CompressedTableIngotInterface } from '../../../common';
import { DatabasesTypes } from '@myroslavshymon/orm';

export abstract class ColumnDataTypeOperationTemplate<DT extends DatabasesTypes> {
	private readonly _databaseManager: DatabaseManagerInterface<DT>;

	protected constructor(
		databaseManager: DatabaseManagerInterface<DT>
	) {
		this._databaseManager = databaseManager;
	}

	protected async _handleColumnDataTypeChange(
		currentTableIngotList: CompressedTableIngotInterface<DT>[],
		lastTableIngotList: CompressedTableIngotInterface<DT>[]
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