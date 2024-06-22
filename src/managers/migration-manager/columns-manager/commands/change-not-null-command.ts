import { ChangeNotNullOfColumnOperation } from '../operations';
import { MigrationCommandInterface } from '../interfaces';

export class ChangeNotNullCommand implements MigrationCommandInterface {
	private operation: ChangeNotNullOfColumnOperation;

	constructor(operation: ChangeNotNullOfColumnOperation) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}