import { ManyToManyInterface } from '@myroslavshymon/orm/orm/core';

export interface ManyToManyRelationsOfDatabaseIngotInterface {
	id: string | undefined;
	name: string;
	manyToMany: ManyToManyInterface[],
}