import { CompressedTableIngotInterface } from '../../../common/interfaces';
import { DatabasesTypes } from '@myroslavshymon/orm';
import {
	BaseColumnInterface,
	ColumnInterface,
	ColumnOptionsInterface,
	ComputedColumnInterface,
	DatabaseManagerInterface,
	DeleteColumnInterface,
	PrimaryGeneratedColumnInterface
} from '@myroslavshymon/orm/dist/orm/core';

export abstract class ColumnOperationsTemplate<DT extends DatabasesTypes> {
	private readonly _databaseManager: DatabaseManagerInterface<DT>;

	protected constructor(
		databaseManager: DatabaseManagerInterface<DT>
	) {
		this._databaseManager = databaseManager;
	}

	protected async _handleColumnDeleting(
		currentTableIngotList: CompressedTableIngotInterface<DT>[],
		lastTableIngotList: CompressedTableIngotInterface<DT>[]
	): Promise<string> {
		let deleteColumnsQuery = '';

		for (const currentTableIngot of currentTableIngotList) {
			for (const lastTableIngot of lastTableIngotList) {
				if (currentTableIngot.id === lastTableIngot.id) {
					const deletedColumns = this._getDeletedColumns(currentTableIngot, lastTableIngot);

					for (const deletedColumn of deletedColumns) {
						deleteColumnsQuery += await this._databaseManager.tableManipulation
							.alterTable(currentTableIngot.name, true)
							.deleteColumn({ columnName: deletedColumn.name } as DeleteColumnInterface<DT>) + '\n\t\t\t\t';
					}
				}
			}
		}

		return deleteColumnsQuery;
	}

	private _getDeletedColumns(
		currentTableIngot: CompressedTableIngotInterface<DT>,
		lastTableIngot: CompressedTableIngotInterface<DT>
	): BaseColumnInterface[] {
		const deletedColumns: ColumnInterface<DT>[] = lastTableIngot.columns
			.filter(
				lastColumn => !currentTableIngot.columns
					.some(currentColumn => currentColumn.id === lastColumn.id)
			);

		const deletedComputedColumns: ComputedColumnInterface<DT>[] = lastTableIngot.computedColumns.filter(lastColumn =>
			!currentTableIngot.computedColumns.some(
				(currentColumn: ComputedColumnInterface<DT>) => currentColumn.id === lastColumn.id
			)
		);

		return [...deletedColumns, ...deletedComputedColumns];
	}

	protected async _handleColumnAdding(
		currentTableIngotList: CompressedTableIngotInterface<DT>[],
		lastTableIngotList: CompressedTableIngotInterface<DT>[]
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
		currentTableIngot: CompressedTableIngotInterface<DT>,
		lastTableIngot: CompressedTableIngotInterface<DT>
	): Promise<string> {
		let addedColumnsQuery = '';

		const addedColumns: ColumnInterface<DT>[] = currentTableIngot.columns.filter(
			currentColumn => !lastTableIngot.columns.some(lastColumn => lastColumn.id === currentColumn.id)
		);

		for (const addedColumn of addedColumns) {
			addedColumnsQuery += await this._databaseManager.tableManipulation
				.alterTable(currentTableIngot.name, true)
				.addColumn({
					columnName: addedColumn.name,
					options: addedColumn.options as ColumnOptionsInterface<DT>
				}) + '\n\t\t\t\t';
		}

		return addedColumnsQuery;
	}

	private async _handleAddedComputedColumns(
		currentTableIngot: CompressedTableIngotInterface<DT>,
		lastTableIngot: CompressedTableIngotInterface<DT>
	): Promise<string> {
		let addedColumnsQuery = '';

		const addedComputedColumns: ComputedColumnInterface<DT>[] = currentTableIngot.computedColumns.filter(
			currentColumn => !lastTableIngot.computedColumns.some(lastColumn => lastColumn.id === currentColumn.id)
		);

		for (const { name, dataType, calculate } of addedComputedColumns) {
			addedColumnsQuery += await this._databaseManager.tableManipulation
				.alterTable(name, true)
				.addComputedColumn({ dataType, calculate } as ComputedColumnInterface<DT>) + '\n\t\t\t\t';
		}

		return addedColumnsQuery;
	}

	private async _handlePrimaryColumn(
		currentTableIngot: CompressedTableIngotInterface<DT>,
		lastTableIngot: CompressedTableIngotInterface<DT>
	): Promise<string> {
		let addedColumnsQuery = '';

		if (currentTableIngot.primaryColumn && !lastTableIngot.primaryColumn) {
			addedColumnsQuery += await this._databaseManager.tableManipulation
				.alterTable(currentTableIngot.name, true)
				.addPrimaryGeneratedColumn({
					columnName: currentTableIngot.primaryColumn.columnName,
					type: currentTableIngot.primaryColumn.type
				} as PrimaryGeneratedColumnInterface<DT>) + '\n\t\t\t\t';
		}

		if (!currentTableIngot.primaryColumn && lastTableIngot.primaryColumn) {
			addedColumnsQuery += await this._databaseManager.tableManipulation
				.alterTable(currentTableIngot.name, true)
				.deleteColumn({
					columnName: lastTableIngot.primaryColumn.columnName
				} as DeleteColumnInterface<DT>) + '\n\t\t\t\t';
		}

		return addedColumnsQuery;
	}
}