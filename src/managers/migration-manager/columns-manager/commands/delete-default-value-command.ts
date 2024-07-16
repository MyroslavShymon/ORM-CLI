import { MigrationCommandInterface } from '../interfaces';
import { DeleteDefaultValueFromColumnOperation } from '../operations';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class DeleteDefaultValueCommand<DT extends DatabasesTypes> implements MigrationCommandInterface {
	private operation: DeleteDefaultValueFromColumnOperation<DT>;

	constructor(operation: DeleteDefaultValueFromColumnOperation<DT>) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}