import { Migration } from '@mikro-orm/migrations';

export class Migration20251101120000_AddCoupons extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`coupons\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`code\` varchar(255) not null, \`description\` varchar(255) null, \`amount\` numeric(10,2) not null, \`remaining_amount\` numeric(10,2) not null, \`status\` enum('ACTIVE', 'INACTIVE', 'EXPIRED', 'EXHAUSTED') not null default 'ACTIVE', \`expires_at\` datetime null, \`assigned_to\` varchar(255) null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`coupons\` add unique \`coupons_code_unique\`(\`code\`);`);
    this.addSql(`alter table \`coupons\` add index \`coupons_assigned_to_index\`(\`assigned_to\`);`);
    this.addSql(`alter table \`coupons\` add constraint \`coupons_assigned_to_foreign\` foreign key (\`assigned_to\`) references \`users\` (\`uuid\`) on update cascade on delete set null;`);

    this.addSql(`alter table \`bookings\` add \`coupon\` varchar(255) null;`);
    this.addSql(`alter table \`bookings\` add \`coupon_discount\` numeric(10,2) not null default 0;`);
    this.addSql(`alter table \`bookings\` add constraint \`bookings_coupon_foreign\` foreign key (\`coupon\`) references \`coupons\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`bookings\` add index \`bookings_coupon_index\`(\`coupon\`);`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`bookings\` drop foreign key \`bookings_coupon_foreign\`;`);
    this.addSql(`alter table \`bookings\` drop index \`bookings_coupon_index\`;`);
    this.addSql(`alter table \`bookings\` drop column \`coupon\`;`);
    this.addSql(`alter table \`bookings\` drop column \`coupon_discount\`;`);

    this.addSql(`drop table if exists \`coupons\`;`);
  }

}
