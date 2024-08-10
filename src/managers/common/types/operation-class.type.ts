import { DatabasesTypes } from '@myroslavshymon/orm';
import { CompressedTableIngotInterface } from '../interfaces';
import { OperationInterface } from '../../migration-manager';
import { DatabaseManagerInterface } from '@myroslavshymon/orm/dist/orm/core';

export type OperationClass<O extends OperationInterface, DT extends DatabasesTypes> = new (
	databaseManager: DatabaseManagerInterface<DT>,
	currentCompressedTables: CompressedTableIngotInterface<DT>[],
	lastCompressedTables: CompressedTableIngotInterface<DT>[]
) => O;