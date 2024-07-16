import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { GetMigrationTableInterface } from './get-migration-table.interface';
import { DatabasesTypes } from '@myroslavshymon/orm';

export interface AddMigrationInterface<DT extends DatabasesTypes> extends GetMigrationTableInterface {
	migrationName: string,
	databaseIngot: DatabaseIngotInterface<DT>,
}