import { MigrationCommandInterface } from './interfaces';
import { AddColumnOperation } from './operations';

export class AddColumnCommand implements MigrationCommandInterface {
	private operation: AddColumnOperation;

	constructor(operation: AddColumnOperation) {
		this.operation = operation;
	}

	public async execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	public async undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}