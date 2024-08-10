import { OneToOneInterface } from '@myroslavshymon/orm/dist/orm/core';

export interface OneToOneRelationsOfDatabaseIngotInterface {
	id: string | undefined;
	name: string;
	oneToOne: OneToOneInterface[],
}