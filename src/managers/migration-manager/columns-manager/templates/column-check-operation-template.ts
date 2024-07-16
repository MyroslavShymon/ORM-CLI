import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { CompressedTableIngotInterface } from '../../../common';

export abstract class ColumnCheckOperationTemplate<DT extends DatabasesTypes> {
	private readonly _databaseManager: DatabaseManagerInterface<DT>;

	protected constructor(
		databaseManager: DatabaseManagerInterface<DT>
	) {
		this._databaseManager = databaseManager;
	}

	protected async _handleColumnCheckConstraintChange(
		currentTableIngotList: CompressedTableIngotInterface<DT>[],
		lastTableIngotList: CompressedTableIngotInterface<DT>[]
	): Promise<string> {
		let queryWithHandledCheckConstraint = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const columnsWithChangedCheckConstraint = currentTableIngot.columns.filter(
						currentColumn => lastTableIngot.columns.some(
							lastColumn =>
								currentColumn.id === lastColumn.id &&
								(
									lastColumn.options?.check !== currentColumn.options?.check ||
									lastColumn.options?.nameOfCheckConstraint !== currentColumn.options?.nameOfCheckConstraint
								)
						)
					);

					for (const columnWithChangedCheckConstraint of columnsWithChangedCheckConstraint) {
						if (!columnWithChangedCheckConstraint.options?.check) {
							queryWithHandledCheckConstraint += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.deleteCheckConstraintOfColumn(
									{ columnName: columnWithChangedCheckConstraint.name }
								) + '\n\t\t\t\t';
						} else {
							queryWithHandledCheckConstraint += await this._databaseManager.tableManipulation
								.alterTable(currentTableIngot.name, true)
								.addCheckConstraintToColumn(
									{
										columnName: columnWithChangedCheckConstraint.name,
										check: String(columnWithChangedCheckConstraint.options?.check),
										nameOfCheckConstraint: columnWithChangedCheckConstraint.options?.nameOfCheckConstraint
									}
								) + '\n\t\t\t\t';
						}
					}
				}
			}
		}

		return queryWithHandledCheckConstraint;
	}
}