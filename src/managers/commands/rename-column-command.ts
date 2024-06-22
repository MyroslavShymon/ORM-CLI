import { MigrationCommandInterface } from './interfaces';
import { RenameOfColumnOperation } from './operations';

export class RenameColumnCommand implements MigrationCommandInterface {
	private operation: RenameOfColumnOperation;

	constructor(operation: RenameOfColumnOperation) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}