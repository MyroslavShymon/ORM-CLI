import { ChangeNotNullOfColumnOperation } from '../operations';
import { MigrationCommandInterface } from '../interfaces';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class ChangeNotNullCommand<DT extends DatabasesTypes> implements MigrationCommandInterface {
	private operation: ChangeNotNullOfColumnOperation<DT>;

	constructor(operation: ChangeNotNullOfColumnOperation<DT>) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}