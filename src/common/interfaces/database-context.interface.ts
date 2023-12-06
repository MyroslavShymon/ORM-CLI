import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { AddMigrationInterface } from './add-migration.interface';
import { GetMigrationTableInterface } from './get-migration-table.interface';
import { ConnectionData } from '../types';
import { UpdateMigrationStatusInterface } from './update-migration-status.interface';

export interface DatabaseContextInterface {
	connect(dataToConnect: ConnectionData): Promise<void>;

	createMigration(options: AddMigrationInterface): Promise<void>;

	getCurrentDatabaseIngot(options: GetMigrationTableInterface): Promise<DatabaseIngotInterface>;

	updateMigrationStatus(options: UpdateMigrationStatusInterface): Promise<void>;

	query(sql: string): Promise<any>;
}