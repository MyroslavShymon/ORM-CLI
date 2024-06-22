import { MigrationCommandInterface, OperationInterface } from '../../commands';

export type CommandClass<O extends OperationInterface, C extends MigrationCommandInterface> = new (operation: O) => C;
