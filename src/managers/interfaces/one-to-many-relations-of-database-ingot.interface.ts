import { OneToManyInterface } from '@myroslavshymon/orm/orm/core';

export interface OneToManyRelationsOfDatabaseIngotInterface {
	id: string | undefined;
	name: string;
	oneToMany: OneToManyInterface[],
}