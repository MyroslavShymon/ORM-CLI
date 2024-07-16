import { ColumnDefaultValueOperationsTemplate } from '../templates';
import { OperationInterface } from '../interfaces';
import { CompressedTableIngotInterface } from '../../../common/interfaces';
import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class DeleteDefaultValueFromColumnOperation<DT extends DatabasesTypes> extends ColumnDefaultValueOperationsTemplate<DT> implements OperationInterface {
	private readonly _currentCompressedTables: CompressedTableIngotInterface<DT>[];
	private readonly _lastCompressedTables: CompressedTableIngotInterface<DT>[];

	constructor(
		databaseManager: DatabaseManagerInterface<DT>,
		currentCompressedTables: CompressedTableIngotInterface<DT>[],
		lastCompressedTables: CompressedTableIngotInterface<DT>[]
	) {
		super(databaseManager);
		this._currentCompressedTables = currentCompressedTables;
		this._lastCompressedTables = lastCompressedTables;
	}

	executeOperation(): Promise<string> {
		return this._handleColumnDefaultValueDeleting(this._currentCompressedTables, this._lastCompressedTables);
	}

	undoOperation(): Promise<string> {
		return this._handleColumnDefaultValueAdding(this._lastCompressedTables, this._currentCompressedTables);
	}
}