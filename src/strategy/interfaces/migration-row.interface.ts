import { RowDataPacket } from 'mysql2/promise';
import { DatabasesTypes } from '@myroslavshymon/orm';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/dist/orm/core';

export interface MigrationRowInterface extends RowDataPacket {
	id: number;
	ingot: DatabaseIngotInterface<DatabasesTypes.MYSQL>;
}