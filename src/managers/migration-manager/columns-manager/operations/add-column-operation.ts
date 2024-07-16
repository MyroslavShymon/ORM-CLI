import { ColumnOperationsTemplate } from '../templates';
import { OperationInterface } from '../interfaces';
import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { CompressedTableIngotInterface } from '../../../common/interfaces';

export class AddColumnOperation<DT extends DatabasesTypes> extends ColumnOperationsTemplate<DT> implements OperationInterface {
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

	async executeOperation(): Promise<string> {
		return this._handleColumnAdding(this._currentCompressedTables, this._lastCompressedTables);
	}

	async undoOperation(): Promise<string> {
		return this._handleColumnDeleting(this._lastCompressedTables, this._currentCompressedTables);
	}
}