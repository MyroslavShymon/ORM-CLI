import { ColumnOperationsTemplate } from '../templates';
import { OperationInterface } from '../interfaces';
import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { CompressedTableIngotInterface } from '../../common/interfaces';

export class AddColumnOperation extends ColumnOperationsTemplate implements OperationInterface {
	private readonly _currentCompressedTables: CompressedTableIngotInterface[];
	private readonly _lastCompressedTables: CompressedTableIngotInterface[];

	constructor(
		databaseManager: DatabaseManagerInterface<DatabasesTypes>,
		currentCompressedTables: CompressedTableIngotInterface[],
		lastCompressedTables: CompressedTableIngotInterface[]
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