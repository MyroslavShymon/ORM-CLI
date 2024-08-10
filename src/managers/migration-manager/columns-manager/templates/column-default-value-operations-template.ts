import { DatabasesTypes } from '@myroslavshymon/orm';
import { CompressedTableIngotInterface } from '../../../common/interfaces';
import { DatabaseManagerInterface } from '@myroslavshymon/orm/dist/orm/core';

export abstract class ColumnDefaultValueOperationsTemplate<DT extends DatabasesTypes> {
	private readonly _databaseManager: DatabaseManagerInterface<DT>;

	protected constructor(
		databaseManager: DatabaseManagerInterface<DT>
	) {
		this._databaseManager = databaseManager;
	}

	protected async _handleColumnDefaultValueDeleting(
		currentTableIngotList: CompressedTableIngotInterface<DT>[],
		lastTableIngotList: CompressedTableIngotInterface<DT>[]
	): Promise<string> {
		let queryWithHandledDeletedDefaultValue = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const columnsWithDeletedDefaultValue =
						currentTableIngot.columns
							.filter(currentColumn =>
								lastTableIngot.columns
									.some(lastColumn =>
										currentColumn.id === lastColumn.id &&
										currentColumn.options?.defaultValue === undefined &&
										lastColumn.options?.defaultValue !== undefined
									)
							);

					for (const columnWithDeletedDefaultValue of columnsWithDeletedDefaultValue) {
						queryWithHandledDeletedDefaultValue += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.dropDefaultValue({ columnName: columnWithDeletedDefaultValue.name }) + '\n\t\t\t\t';
					}
				}
			}
		}

		return queryWithHandledDeletedDefaultValue;
	}

	protected async _handleColumnDefaultValueAdding(
		currentTableIngotList: CompressedTableIngotInterface<DT>[],
		lastTableIngotList: CompressedTableIngotInterface<DT>[]
	): Promise<string> {
		let queryWithHandledAddedDefaultValue = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const columnsWithChangedDefaultValue =
						currentTableIngot.columns
							.filter(currentColumn =>
								lastTableIngot.columns
									.some(lastColumn =>
										currentColumn.id === lastColumn.id &&
										currentColumn.options?.defaultValue !== undefined &&
										(
											lastColumn.options?.defaultValue === undefined ||
											currentColumn.options?.defaultValue !== lastColumn.options?.defaultValue
										)
									)
							);


					for (const columnWithChangedDefaultValue of columnsWithChangedDefaultValue) {
						if (columnWithChangedDefaultValue.options?.defaultValue !== undefined) {
							queryWithHandledAddedDefaultValue += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.addDefaultValue(
									{
										columnName: columnWithChangedDefaultValue.name,
										value: columnWithChangedDefaultValue.options.defaultValue
									}
								) + '\n\t\t\t\t';
						}
					}
				}
			}
		}

		return queryWithHandledAddedDefaultValue;
	}
}