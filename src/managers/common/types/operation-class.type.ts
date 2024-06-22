import { DatabaseManagerInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { CompressedTableIngotInterface } from '../interfaces';
import { OperationInterface } from '../../migration-manager';

export type OperationClass<O extends OperationInterface> = new (
	databaseManager: DatabaseManagerInterface<DatabasesTypes>,
	currentCompressedTables: CompressedTableIngotInterface[],
	lastCompressedTables: CompressedTableIngotInterface[]
) => O;