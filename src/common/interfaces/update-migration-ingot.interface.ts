import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';

export interface UpdateMigrationIngotInterface<DT extends DatabasesTypes> {
	ingot: DatabaseIngotInterface<DT>;
	migrationTable?: string;
	migrationTableSchema?: string;
	migrationName?: string;
}