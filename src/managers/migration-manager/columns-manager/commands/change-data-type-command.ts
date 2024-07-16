import { MigrationCommandInterface } from '../interfaces';
import { ChangeDataTypeOfColumnOperation } from '../operations';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class ChangeDataTypeCommand<DT extends DatabasesTypes> implements MigrationCommandInterface {
	private operation: ChangeDataTypeOfColumnOperation<DT>;

	constructor(operation: ChangeDataTypeOfColumnOperation<DT>) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}