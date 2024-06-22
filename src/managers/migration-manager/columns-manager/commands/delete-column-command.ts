import { MigrationCommandInterface } from '../interfaces';
import { DeleteColumnOperation } from '../operations';

export class DeleteColumnCommand implements MigrationCommandInterface {
	private operation: DeleteColumnOperation;

	constructor(operation: DeleteColumnOperation) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}