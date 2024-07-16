import { MigrationCommandInterface } from '../interfaces';
import { ChangeCheckConstraintOfColumnOperation } from '../operations';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class ChangeCheckConstraintCommand<DT extends DatabasesTypes> implements MigrationCommandInterface {
	private operation: ChangeCheckConstraintOfColumnOperation<DT>;

	constructor(operation: ChangeCheckConstraintOfColumnOperation<DT>) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}