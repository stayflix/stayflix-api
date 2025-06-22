import { Entity, Filter, PrimaryKey, Property } from "@mikro-orm/core";
import { Timestamp } from "../../base/timestamp.entity";

@Filter({
    name: 'notDeleted',
    cond: { deletedAt: null },
    default: true
})
@Entity({ tableName: 'admin_users' })
export class AdminUser extends Timestamp {
    @PrimaryKey()
    uuid: string;

    @Property({ nullable: true })
    fullname: string;

    @Property({ nullable: true })
    email: string;

    @Property({ nullable: true })
    password: string;
}