import { RowDataPacket } from 'mysql2/promise';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';

export interface MigrationRowInterface extends RowDataPacket {
	id: number;
	ingot: DatabaseIngotInterface<DatabasesTypes.MYSQL>;
}