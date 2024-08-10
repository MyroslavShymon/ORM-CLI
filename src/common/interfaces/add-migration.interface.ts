import { GetMigrationTableInterface } from './get-migration-table.interface';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/dist/orm/core';

export interface AddMigrationInterface<DT extends DatabasesTypes> extends GetMigrationTableInterface {
	migrationName: string,
	databaseIngot: DatabaseIngotInterface<DT>,
}