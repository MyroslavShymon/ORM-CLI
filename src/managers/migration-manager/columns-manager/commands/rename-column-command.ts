import { MigrationCommandInterface } from '../interfaces';
import { RenameOfColumnOperation } from '../operations';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class RenameColumnCommand<DT extends DatabasesTypes> implements MigrationCommandInterface {
	private operation: RenameOfColumnOperation<DT>;

	constructor(operation: RenameOfColumnOperation<DT>) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}