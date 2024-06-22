import { MigrationCommandInterface } from '../interfaces';
import { ChangeDataTypeOfColumnOperation } from '../operations';

export class ChangeDataTypeCommand implements MigrationCommandInterface {
	private operation: ChangeDataTypeOfColumnOperation;

	constructor(operation: ChangeDataTypeOfColumnOperation) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}