import { RenameOfColumnOperationTemplate } from '../templates';
import { OperationInterface } from '../interfaces';
import { CompressedTableIngotInterface } from '../../../common';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { DatabaseManagerInterface } from '@myroslavshymon/orm/dist/orm/core';

export class RenameOfColumnOperation<DT extends DatabasesTypes> extends RenameOfColumnOperationTemplate<DT> implements OperationInterface {
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
		return this._handleRenameOfColumn(this._currentCompressedTables, this._lastCompressedTables);
	}

	undoOperation(): Promise<string> {
		return this._handleRenameOfColumn(this._lastCompressedTables, this._currentCompressedTables);
	}
}