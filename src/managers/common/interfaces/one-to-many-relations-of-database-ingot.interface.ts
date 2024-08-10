import { OneToManyInterface } from '@myroslavshymon/orm/dist/orm/core';

export interface OneToManyRelationsOfDatabaseIngotInterface {
	id: string | undefined;
	name: string;
	oneToMany: OneToManyInterface[],
}