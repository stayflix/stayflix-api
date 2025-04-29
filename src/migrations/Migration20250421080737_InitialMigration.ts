import { Migration } from '@mikro-orm/migrations';

export class Migration20250421080737_InitialMigration extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`blacklisted_tokens\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`token\` longtext null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`notification_templates\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`code\` varchar(255) not null, \`body\` longtext not null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`notification_templates\` add unique \`notification_templates_code_unique\`(\`code\`);`);

    this.addSql(`create table \`otp\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`otp\` varchar(6) not null, \`pin_id\` varchar(255) not null, \`expired_at\` datetime null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`users\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`full_name\` varchar(255) null, \`preferred_firstname\` varchar(255) null, \`email\` varchar(255) null, \`password\` varchar(255) null, \`phone\` varchar(255) null, \`country\` varchar(255) null, \`state\` varchar(255) null, \`city\` varchar(255) null, \`user_type\` varchar(255) null, \`picture\` varchar(255) null, \`device_token\` varchar(255) null, \`email_verified\` tinyint(1) not null default false, \`phone_verified\` tinyint(1) not null default false, \`last_logged_in\` datetime null, \`emergency_contact_fullname\` varchar(255) null, \`emergency_contact_relationship\` varchar(255) null, \`emergency_contact_email\` varchar(255) null, \`emergency_contact_phone\` varchar(255) null, \`nin\` varchar(255) null, \`deactivation_reason\` varchar(255) null, \`registration_type\` enum('GOOGLE', 'FACEBOOK', 'APPLE', 'WEB', 'MOBILE') null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`apartments\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`apartment_type\` varchar(255) null, \`space_type_available\` enum('ENTIRE_PLACE', 'ROOM', 'SHARED_ROOM') null, \`address\` varchar(255) null, \`guest_count\` int not null default 0, \`bedroom_count\` int not null default 0, \`bed_count\` int not null default 0, \`bathroom_count\` int not null default 0, \`amenities\` varchar(255) null, \`photos\` varchar(255) null, \`title\` varchar(255) null, \`highlights\` varchar(255) null, \`description\` varchar(255) null, \`reservation_type\` enum('INSTANT_BOOK', 'BOOKING_REQUEST') null, \`first_reservation_type\` enum('GUEST', 'EXPERIENCED_GUEST') null, \`weekday_base_price\` int not null default 0, \`allowed_discounts\` varchar(255) null, \`created_by\` varchar(255) null, \`avg_rating\` int not null default 0, \`published\` tinyint(1) not null default false, \`status\` enum('PENDING', 'AVAILABLE') null, \`draft\` tinyint(1) not null default true, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`apartments\` add index \`apartments_created_by_index\`(\`created_by\`);`);

    this.addSql(`create table \`wishlist\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`title\` varchar(255) null, \`user\` varchar(255) null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`wishlist\` add index \`wishlist_user_index\`(\`user\`);`);

    this.addSql(`create table \`wishlisted_apartments\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`wishlist\` varchar(255) null, \`apartment\` varchar(255) null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`wishlisted_apartments\` add index \`wishlisted_apartments_wishlist_index\`(\`wishlist\`);`);
    this.addSql(`alter table \`wishlisted_apartments\` add index \`wishlisted_apartments_apartment_index\`(\`apartment\`);`);
    this.addSql(`alter table \`wishlisted_apartments\` add unique \`wishlisted_apartments_wishlist_apartment_unique\`(\`wishlist\`, \`apartment\`);`);

    this.addSql(`alter table \`apartments\` add constraint \`apartments_created_by_foreign\` foreign key (\`created_by\`) references \`users\` (\`uuid\`) on update cascade on delete set null;`);

    this.addSql(`alter table \`wishlist\` add constraint \`wishlist_user_foreign\` foreign key (\`user\`) references \`users\` (\`uuid\`) on update cascade on delete set null;`);

    this.addSql(`alter table \`wishlisted_apartments\` add constraint \`wishlisted_apartments_wishlist_foreign\` foreign key (\`wishlist\`) references \`wishlist\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`wishlisted_apartments\` add constraint \`wishlisted_apartments_apartment_foreign\` foreign key (\`apartment\`) references \`apartments\` (\`uuid\`) on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`apartments\` drop foreign key \`apartments_created_by_foreign\`;`);

    this.addSql(`alter table \`wishlist\` drop foreign key \`wishlist_user_foreign\`;`);

    this.addSql(`alter table \`wishlisted_apartments\` drop foreign key \`wishlisted_apartments_apartment_foreign\`;`);

    this.addSql(`alter table \`wishlisted_apartments\` drop foreign key \`wishlisted_apartments_wishlist_foreign\`;`);

    this.addSql(`drop table if exists \`blacklisted_tokens\`;`);

    this.addSql(`drop table if exists \`notification_templates\`;`);

    this.addSql(`drop table if exists \`otp\`;`);

    this.addSql(`drop table if exists \`users\`;`);

    this.addSql(`drop table if exists \`apartments\`;`);

    this.addSql(`drop table if exists \`wishlist\`;`);

    this.addSql(`drop table if exists \`wishlisted_apartments\`;`);
  }

}
