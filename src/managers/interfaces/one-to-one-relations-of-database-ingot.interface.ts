import { OneToOneInterface } from '@myroslavshymon/orm/orm/core';

export interface OneToOneRelationsOfDatabaseIngotInterface {
	id: string | undefined;
	name: string;
	oneToOne: OneToOneInterface[],
}