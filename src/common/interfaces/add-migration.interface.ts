import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { GetMigrationTableInterface } from './get-migration-table.interface';

export interface AddMigrationInterface extends GetMigrationTableInterface {
	migrationName: string,
	databaseIngot: DatabaseIngotInterface,
}