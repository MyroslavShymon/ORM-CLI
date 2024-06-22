import { MigrationCommandInterface } from '../interfaces';
import { DeleteDefaultValueFromColumnOperation } from '../operations';

export class DeleteDefaultValueCommand implements MigrationCommandInterface {
	private operation: DeleteDefaultValueFromColumnOperation;

	constructor(operation: DeleteDefaultValueFromColumnOperation) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}