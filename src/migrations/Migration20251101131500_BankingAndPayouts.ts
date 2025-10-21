import { Migration } from '@mikro-orm/migrations';

export class Migration20251101131500_BankingAndPayouts extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`user_bank_accounts\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`user\` varchar(255) not null, \`bank_name\` varchar(255) not null, \`bank_code\` varchar(255) not null, \`account_name\` varchar(255) not null, \`account_number\` varchar(255) not null, \`recipient_code\` varchar(255) null, \`is_default\` tinyint(1) not null default false, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`user_bank_accounts\` add unique \`user_bank_accounts_account_number_unique\`(\`account_number\`);`);
    this.addSql(`alter table \`user_bank_accounts\` add index \`user_bank_accounts_user_index\`(\`user\`);`);
    this.addSql(`alter table \`user_bank_accounts\` add constraint \`user_bank_accounts_user_foreign\` foreign key (\`user\`) references \`users\` (\`uuid\`) on update cascade on delete cascade;`);

    this.addSql(`alter table \`apartment_reviews\` add \`booking\` varchar(255) null;`);
    this.addSql(`alter table \`apartment_reviews\` add index \`apartment_reviews_booking_index\`(\`booking\`);`);
    this.addSql(`alter table \`apartment_reviews\` add constraint \`apartment_reviews_booking_foreign\` foreign key (\`booking\`) references \`bookings\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`apartment_reviews\` modify \`review\` text null;`);

    this.addSql(`alter table \`pay_outs\` add \`status\` varchar(255) null, add \`transfer_code\` varchar(255) null, add \`provider_reference\` varchar(255) null, add \`metadata\` longtext null, add \`currency\` enum('NGN') not null default 'NGN';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`apartment_reviews\` drop foreign key \`apartment_reviews_booking_foreign\`;`);
    this.addSql(`alter table \`apartment_reviews\` drop index \`apartment_reviews_booking_index\`;`);
    this.addSql(`alter table \`apartment_reviews\` drop column \`booking\`;`);
    this.addSql(`alter table \`apartment_reviews\` modify \`review\` varchar(255) null;`);

    this.addSql(`alter table \`pay_outs\` drop column \`status\`;`);
    this.addSql(`alter table \`pay_outs\` drop column \`transfer_code\`;`);
    this.addSql(`alter table \`pay_outs\` drop column \`provider_reference\`;`);
    this.addSql(`alter table \`pay_outs\` drop column \`metadata\`;`);
    this.addSql(`alter table \`pay_outs\` drop column \`currency\`;`);

    this.addSql(`drop table if exists \`user_bank_accounts\`;`);
  }

}
