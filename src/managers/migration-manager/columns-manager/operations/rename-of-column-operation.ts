import { RenameOfColumnOperationTemplate } from '../templates';
import { OperationInterface } from '../interfaces';
import { CompressedTableIngotInterface } from '../../../common';
import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class RenameOfColumnOperation extends RenameOfColumnOperationTemplate implements OperationInterface {
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

	executeOperation(): Promise<string> {
		return this._handleRenameOfColumn(this._currentCompressedTables, this._lastCompressedTables);
	}

	undoOperation(): Promise<string> {
		return this._handleRenameOfColumn(this._lastCompressedTables, this._currentCompressedTables);
	}
}