import { MigrationCommandInterface } from './interfaces';
import { ChangeUniqueValueOfColumnOperation } from './operations';

export class ChangeUniqueCommand implements MigrationCommandInterface {
	private operation: ChangeUniqueValueOfColumnOperation;

	constructor(operation: ChangeUniqueValueOfColumnOperation) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}