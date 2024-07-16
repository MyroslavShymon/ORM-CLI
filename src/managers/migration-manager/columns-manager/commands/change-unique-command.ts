import { MigrationCommandInterface } from '../interfaces';
import { ChangeUniqueValueOfColumnOperation } from '../operations';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class ChangeUniqueCommand<DT extends DatabasesTypes> implements MigrationCommandInterface {
	private operation: ChangeUniqueValueOfColumnOperation<DT>;

	constructor(operation: ChangeUniqueValueOfColumnOperation<DT>) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}