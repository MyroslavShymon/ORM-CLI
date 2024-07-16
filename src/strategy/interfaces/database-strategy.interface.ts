import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import {
	AddMigrationInterface,
	CheckTableExistenceInterface,
	ConnectionData,
	GetMigrationByNameInterface,
	GetMigrationTableInterface,
	UpdateMigrationIngotInterface,
	UpdateMigrationStatusInterface
} from '../../common';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { Connection } from 'mysql2/promise';
import { PoolClient } from 'pg';

export interface DatabaseStrategy<DT extends DatabasesTypes> {
	client: DT extends DatabasesTypes.MYSQL ? Connection : DT extends DatabasesTypes.POSTGRES ? PoolClient : never;

	connect(dataToConnect: ConnectionData): Promise<void>;

	checkTableExistence(options: CheckTableExistenceInterface): Promise<void>;

	createMigration(options: AddMigrationInterface<DT>): Promise<void>;

	getCurrentDatabaseIngot(options: GetMigrationTableInterface): Promise<DatabaseIngotInterface<DT>>;

	getLastDatabaseIngot(options: GetMigrationTableInterface): Promise<DatabaseIngotInterface<DT>>;

	updateMigrationStatus(options: UpdateMigrationStatusInterface): Promise<void>;

	updateMigrationIngot(options: UpdateMigrationIngotInterface<DT>): Promise<void>;

	getMigrationByName(options: GetMigrationByNameInterface): Promise<{ name: string, is_up: boolean }[]>;

	query(sql: string): Promise<any>;
}
