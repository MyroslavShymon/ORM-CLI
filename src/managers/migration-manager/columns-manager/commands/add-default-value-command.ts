import { MigrationCommandInterface } from '../interfaces';
import { AddDefaultValueToColumnOperation } from '../operations';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class AddDefaultValueCommand<DT extends DatabasesTypes> implements MigrationCommandInterface {
	private operation: AddDefaultValueToColumnOperation<DT>;

	constructor(operation: AddDefaultValueToColumnOperation<DT>) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}