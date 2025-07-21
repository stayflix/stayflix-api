import { Migration } from '@mikro-orm/migrations';

export class Migration20250721015147_AddPaymentTable extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`payments\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`transaction_id\` varchar(255) null, \`status\` varchar(255) null, \`amount\` numeric(10,2) null, \`channel\` varchar(255) null, \`metadata\` longtext null, \`type\` enum('INCOMING', 'OUTGOING') not null, \`currency\` enum('NGN') not null default 'NGN', primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`drop table if exists \`wishlisted_apartments\`;`);

    this.addSql(`alter table \`bookings\` add \`payment\` varchar(255) null;`);
    this.addSql(`alter table \`bookings\` add constraint \`bookings_payment_foreign\` foreign key (\`payment\`) references \`payments\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`bookings\` add index \`bookings_payment_index\`(\`payment\`);`);

    this.addSql(`alter table \`wishlist\` drop column \`title\`;`);

    this.addSql(`alter table \`wishlist\` add \`apartment\` varchar(255) null;`);
    this.addSql(`alter table \`wishlist\` add constraint \`wishlist_apartment_foreign\` foreign key (\`apartment\`) references \`apartments\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`wishlist\` add index \`wishlist_apartment_index\`(\`apartment\`);`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`bookings\` drop foreign key \`bookings_payment_foreign\`;`);

    this.addSql(`create table \`wishlisted_apartments\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`wishlist\` varchar(255) null, \`apartment\` varchar(255) null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`wishlisted_apartments\` add index \`wishlisted_apartments_wishlist_index\`(\`wishlist\`);`);
    this.addSql(`alter table \`wishlisted_apartments\` add index \`wishlisted_apartments_apartment_index\`(\`apartment\`);`);
    this.addSql(`alter table \`wishlisted_apartments\` add unique \`wishlisted_apartments_wishlist_apartment_unique\`(\`wishlist\`, \`apartment\`);`);

    this.addSql(`alter table \`wishlisted_apartments\` add constraint \`wishlisted_apartments_wishlist_foreign\` foreign key (\`wishlist\`) references \`wishlist\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`wishlisted_apartments\` add constraint \`wishlisted_apartments_apartment_foreign\` foreign key (\`apartment\`) references \`apartments\` (\`uuid\`) on update cascade on delete set null;`);

    this.addSql(`drop table if exists \`payments\`;`);

    this.addSql(`alter table \`wishlist\` drop foreign key \`wishlist_apartment_foreign\`;`);

    this.addSql(`alter table \`bookings\` drop index \`bookings_payment_index\`;`);
    this.addSql(`alter table \`bookings\` drop column \`payment\`;`);

    this.addSql(`alter table \`wishlist\` drop index \`wishlist_apartment_index\`;`);
    this.addSql(`alter table \`wishlist\` drop column \`apartment\`;`);

    this.addSql(`alter table \`wishlist\` add \`title\` varchar(255) null;`);
  }

}
