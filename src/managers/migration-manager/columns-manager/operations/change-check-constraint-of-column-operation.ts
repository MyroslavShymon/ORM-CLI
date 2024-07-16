import { ColumnCheckOperationTemplate } from '../templates';
import { OperationInterface } from '../interfaces';
import { CompressedTableIngotInterface } from '../../../common';
import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class ChangeCheckConstraintOfColumnOperation<DT extends DatabasesTypes> extends ColumnCheckOperationTemplate<DT> implements OperationInterface {
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
		return this._handleColumnCheckConstraintChange(this._currentCompressedTables, this._lastCompressedTables);
	}

	undoOperation(): Promise<string> {
		return this._handleColumnCheckConstraintChange(this._lastCompressedTables, this._currentCompressedTables);
	}
}