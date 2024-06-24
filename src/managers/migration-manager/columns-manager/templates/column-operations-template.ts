import { ColumnInterface, ComputedColumnInterface, DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { CompressedTableIngotInterface } from '../../../common/interfaces';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { BaseColumnInterface } from '@myroslavshymon/orm/orm/core/interfaces';

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
					const deletedColumns = this._getDeletedColumns(currentTableIngot, lastTableIngot);

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

	private _getDeletedColumns(
		currentTableIngot: CompressedTableIngotInterface,
		lastTableIngot: CompressedTableIngotInterface
	): BaseColumnInterface[] {
		const deletedColumns: ColumnInterface[] = lastTableIngot.columns
			.filter(
				lastColumn => !currentTableIngot.columns
					.some(currentColumn => currentColumn.id === lastColumn.id)
			);

		const deletedComputedColumns: ComputedColumnInterface[] = lastTableIngot.computedColumns.filter(lastColumn =>
			!currentTableIngot.computedColumns.some(
				(currentColumn: ComputedColumnInterface) => currentColumn.id === lastColumn.id
			)
		);

		return [...deletedColumns, ...deletedComputedColumns];
	}

	protected async _handleColumnAdding(
		currentTableIngotList: CompressedTableIngotInterface[],
		lastTableIngotList: CompressedTableIngotInterface[]
	): Promise<string> {
		let addedColumnsQuery = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
				if (currentTableIngot.id === lastTableIngot.id) {
					addedColumnsQuery += await this._handleAddedColumns(currentTableIngot, lastTableIngot);
					addedColumnsQuery += await this._handleAddedComputedColumns(currentTableIngot, lastTableIngot);
					addedColumnsQuery += await this._handlePrimaryColumn(currentTableIngot, lastTableIngot);
				}
			}
		}

		return addedColumnsQuery;
	}

	private async _handleAddedColumns(
		currentTableIngot: CompressedTableIngotInterface,
		lastTableIngot: CompressedTableIngotInterface
	): Promise<string> {
		let addedColumnsQuery = '';

		const addedColumns: ColumnInterface[] = currentTableIngot.columns.filter(
			currentColumn => !lastTableIngot.columns.some(lastColumn => lastColumn.id === currentColumn.id)
		);

		for (const addedColumn of addedColumns) {
			addedColumnsQuery += await this._databaseManager.tableManipulation
				.alterTable(currentTableIngot.name, true)
				.addColumn({ columnName: addedColumn.name, options: addedColumn.options }) + '\n\t\t\t\t';
		}

		return addedColumnsQuery;
	}

	private async _handleAddedComputedColumns(
		currentTableIngot: CompressedTableIngotInterface,
		lastTableIngot: CompressedTableIngotInterface
	): Promise<string> {
		let addedColumnsQuery = '';

		const addedComputedColumns: ComputedColumnInterface[] = currentTableIngot.computedColumns.filter(
			currentColumn => !lastTableIngot.computedColumns.some(lastColumn => lastColumn.id === currentColumn.id)
		);

		for (const { name, dataType, calculate } of addedComputedColumns) {
			addedColumnsQuery += await this._databaseManager.tableManipulation
				.alterTable(name, true)
				.addComputedColumn({ dataType, calculate }) + '\n\t\t\t\t';
		}

		return addedColumnsQuery;
	}

	private async _handlePrimaryColumn(
		currentTableIngot: CompressedTableIngotInterface,
		lastTableIngot: CompressedTableIngotInterface
	): Promise<string> {
		let addedColumnsQuery = '';

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

		return addedColumnsQuery;
	}
}