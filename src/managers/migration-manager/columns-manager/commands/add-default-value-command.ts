import { MigrationCommandInterface } from '../interfaces';
import { AddDefaultValueToColumnOperation } from '../operations';

export class AddDefaultValueCommand implements MigrationCommandInterface {
	private operation: AddDefaultValueToColumnOperation;

	constructor(operation: AddDefaultValueToColumnOperation) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}