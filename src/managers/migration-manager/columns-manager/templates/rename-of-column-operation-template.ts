import { ColumnInterface, ComputedColumnInterface, DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { CompressedTableIngotInterface } from '../../../common';
import { ColumnChangeInfo } from '../interfaces';

export abstract class RenameOfColumnOperationTemplate<DT extends DatabasesTypes> {
	private readonly _databaseManager: DatabaseManagerInterface<DT>;

	protected constructor(
		databaseManager: DatabaseManagerInterface<DT>
	) {
		this._databaseManager = databaseManager;
	}

	protected async _handleRenameOfColumn(
		currentTableIngotList: CompressedTableIngotInterface<DT>[],
		lastTableIngotList: CompressedTableIngotInterface<DT>[]
	): Promise<string> {
		let queryWithHandledRenameOfColumn = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const columnsWhoseNameHasChanged = this._getColumnsWhoseNameHasChanged(
						currentTableIngot.columns,
						lastTableIngot.columns
					);

					const computedColumnsWhoseNameHasChanged = this._getColumnsWhoseNameHasChanged(
						currentTableIngot.computedColumns,
						lastTableIngot.computedColumns
					);

					for (const {
						columnName,
						futureColumnName
					} of [...columnsWhoseNameHasChanged, ...computedColumnsWhoseNameHasChanged]) {
						queryWithHandledRenameOfColumn += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.renameColumn(
								{ columnName, futureColumnName }
							) + '\n\t\t\t\t';
					}
				}
			}
		}

		return queryWithHandledRenameOfColumn;
	}

	private _getColumnsWhoseNameHasChanged(
		currentColumns: (ColumnInterface<DT> | ComputedColumnInterface<DT>)[],
		lastColumns: (ColumnInterface<DT> | ComputedColumnInterface<DT>)[]
	): ColumnChangeInfo[] {
		return currentColumns.reduce((acc: ColumnChangeInfo[], currentColumn) => {
			const lastColumn = lastColumns.find(lastColumn => lastColumn.id === currentColumn.id);

			if (lastColumn && currentColumn.name !== lastColumn.name) {
				acc.push({
					...currentColumn,
					futureColumnName: currentColumn.name,
					columnName: lastColumn.name
				});
			}
			return acc;
		}, []);
	};
}