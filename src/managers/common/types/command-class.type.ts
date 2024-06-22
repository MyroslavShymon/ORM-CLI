import { MigrationCommandInterface, OperationInterface } from '../../migration-manager';

export type CommandClass<O extends OperationInterface, C extends MigrationCommandInterface> = new (operation: O) => C;
