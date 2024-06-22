import { MigrationCommandInterface } from './interfaces';
import { ChangeCheckConstraintOfColumnOperation } from './operations';

export class ChangeCheckConstraintCommand implements MigrationCommandInterface {
	private operation: ChangeCheckConstraintOfColumnOperation;

	constructor(operation: ChangeCheckConstraintOfColumnOperation) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}