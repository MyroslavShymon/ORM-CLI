import { MigrationCommandInterface } from '../interfaces';
import { DeleteColumnOperation } from '../operations';
import { DatabasesTypes } from '@myroslavshymon/orm';

export class DeleteColumnCommand<DT extends DatabasesTypes> implements MigrationCommandInterface {
	private operation: DeleteColumnOperation<DT>;

	constructor(operation: DeleteColumnOperation<DT>) {
		this.operation = operation;
	}

	execute(): Promise<string> {
		return this.operation.executeOperation();
	}

	undo(): Promise<string> {
		return this.operation.undoOperation();
	}
}