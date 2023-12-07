import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import {
	AddMigrationInterface,
	ConnectionData,
	GetMigrationTableInterface,
	UpdateMigrationStatusInterface
} from '../../common';

export interface DatabaseContextInterface {
	connect(dataToConnect: ConnectionData): Promise<void>;

	createMigration(options: AddMigrationInterface): Promise<void>;

	getCurrentDatabaseIngot(options: GetMigrationTableInterface): Promise<DatabaseIngotInterface>;

	getLastDatabaseIngot(options: GetMigrationTableInterface): Promise<DatabaseIngotInterface>;

	updateMigrationStatus(options: UpdateMigrationStatusInterface): Promise<void>;

	query(sql: string): Promise<any>;
}