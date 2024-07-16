import { MigrationCommandInterface } from '../interfaces';
import { AddColumnOperation } from '../operations';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class AddColumnCommand<DT extends DatabasesTypes> implements MigrationCommandInterface {
	private operation: AddColumnOperation<DT>;

	constructor(operation: AddColumnOperation<DT>) {
		this.operation = operation;
	}

	public async execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	public async undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}