import { Migration } from '@mikro-orm/migrations';

export class Migration20250622020040_NewTables extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`support_tickets\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`full_name\` varchar(255) null, \`phone\` varchar(255) null, \`email\` varchar(255) null, \`comment\` varchar(255) null, \`status\` varchar(255) not null default 'pending', primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`pay_outs\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`user\` varchar(255) null, \`apartment\` varchar(255) null, \`amount\` int null default 0, \`reference\` varchar(255) null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`pay_outs\` add index \`pay_outs_user_index\`(\`user\`);`);
    this.addSql(`alter table \`pay_outs\` add index \`pay_outs_apartment_index\`(\`apartment\`);`);

    this.addSql(`create table \`pay_ins\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`user\` varchar(255) null, \`apartment\` varchar(255) null, \`amount\` int null default 0, \`reference\` varchar(255) null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`pay_ins\` add index \`pay_ins_user_index\`(\`user\`);`);
    this.addSql(`alter table \`pay_ins\` add index \`pay_ins_apartment_index\`(\`apartment\`);`);

    this.addSql(`create table \`bookings\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`apartment\` varchar(255) null, \`user\` varchar(255) null, \`start_date\` datetime null, \`end_date\` datetime null, \`is_cancelled\` tinyint(1) not null default false, \`is_paid_out\` tinyint(1) not null default false, \`total_amount\` int null, \`reservation_type\` enum('INSTANT_BOOK', 'BOOKING_REQUEST') null, \`status\` enum('Booked', 'Checked In', 'Completed', 'Cancelled') not null default 'Booked', \`notes\` varchar(255) null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`bookings\` add index \`bookings_apartment_index\`(\`apartment\`);`);
    this.addSql(`alter table \`bookings\` add index \`bookings_user_index\`(\`user\`);`);

    this.addSql(`create table \`apartment_reviews\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`user\` varchar(255) null, \`apartment\` varchar(255) null, \`rating\` int null default 0, \`review\` varchar(255) null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`apartment_reviews\` add index \`apartment_reviews_user_index\`(\`user\`);`);
    this.addSql(`alter table \`apartment_reviews\` add index \`apartment_reviews_apartment_index\`(\`apartment\`);`);

    this.addSql(`alter table \`pay_outs\` add constraint \`pay_outs_user_foreign\` foreign key (\`user\`) references \`users\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`pay_outs\` add constraint \`pay_outs_apartment_foreign\` foreign key (\`apartment\`) references \`apartments\` (\`uuid\`) on update cascade on delete set null;`);

    this.addSql(`alter table \`pay_ins\` add constraint \`pay_ins_user_foreign\` foreign key (\`user\`) references \`users\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`pay_ins\` add constraint \`pay_ins_apartment_foreign\` foreign key (\`apartment\`) references \`apartments\` (\`uuid\`) on update cascade on delete set null;`);

    this.addSql(`alter table \`bookings\` add constraint \`bookings_apartment_foreign\` foreign key (\`apartment\`) references \`apartments\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`bookings\` add constraint \`bookings_user_foreign\` foreign key (\`user\`) references \`users\` (\`uuid\`) on update cascade on delete set null;`);

    this.addSql(`alter table \`apartment_reviews\` add constraint \`apartment_reviews_user_foreign\` foreign key (\`user\`) references \`users\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`apartment_reviews\` add constraint \`apartment_reviews_apartment_foreign\` foreign key (\`apartment\`) references \`apartments\` (\`uuid\`) on update cascade on delete set null;`);

    this.addSql(`alter table \`users\` modify \`full_name\` varchar(255), modify \`preferred_firstname\` varchar(255), modify \`email\` varchar(255), modify \`password\` varchar(255), modify \`phone\` varchar(255), modify \`country\` varchar(255), modify \`state\` varchar(255), modify \`city\` varchar(255), modify \`user_type\` varchar(255), modify \`picture\` varchar(255), modify \`device_token\` varchar(255), modify \`emergency_contact_fullname\` varchar(255), modify \`emergency_contact_relationship\` varchar(255), modify \`emergency_contact_email\` varchar(255), modify \`emergency_contact_phone\` varchar(255), modify \`nin\` varchar(255), modify \`deactivation_reason\` varchar(255), modify \`registration_type\` enum('GOOGLE', 'FACEBOOK', 'APPLE', 'WEB', 'MOBILE');`);

    this.addSql(`alter table \`apartments\` add \`city\` varchar(255) null;`);
    this.addSql(`alter table \`apartments\` modify \`apartment_type\` varchar(255), modify \`space_type_available\` enum('ENTIRE_PLACE', 'ROOM', 'SHARED_ROOM'), modify \`address\` varchar(255), modify \`amenities\` varchar(255), modify \`photos\` varchar(255), modify \`title\` varchar(255), modify \`highlights\` varchar(255), modify \`description\` varchar(255), modify \`reservation_type\` enum('INSTANT_BOOK', 'BOOKING_REQUEST'), modify \`first_reservation_type\` enum('GUEST', 'EXPERIENCED_GUEST'), modify \`allowed_discounts\` varchar(255), modify \`created_by\` varchar(255), modify \`status\` enum('PENDING', 'AVAILABLE');`);

    this.addSql(`alter table \`wishlist\` modify \`title\` varchar(255), modify \`user\` varchar(255);`);

    this.addSql(`alter table \`wishlisted_apartments\` modify \`wishlist\` varchar(255), modify \`apartment\` varchar(255);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`support_tickets\`;`);

    this.addSql(`drop table if exists \`pay_outs\`;`);

    this.addSql(`drop table if exists \`pay_ins\`;`);

    this.addSql(`drop table if exists \`bookings\`;`);

    this.addSql(`drop table if exists \`apartment_reviews\`;`);

    this.addSql(`alter table \`users\` modify \`full_name\` varchar(255) default 'NULL', modify \`preferred_firstname\` varchar(255) default 'NULL', modify \`email\` varchar(255) default 'NULL', modify \`password\` varchar(255) default 'NULL', modify \`phone\` varchar(255) default 'NULL', modify \`country\` varchar(255) default 'NULL', modify \`state\` varchar(255) default 'NULL', modify \`city\` varchar(255) default 'NULL', modify \`user_type\` varchar(255) default 'NULL', modify \`picture\` varchar(255) default 'NULL', modify \`device_token\` varchar(255) default 'NULL', modify \`emergency_contact_fullname\` varchar(255) default 'NULL', modify \`emergency_contact_relationship\` varchar(255) default 'NULL', modify \`emergency_contact_email\` varchar(255) default 'NULL', modify \`emergency_contact_phone\` varchar(255) default 'NULL', modify \`nin\` varchar(255) default 'NULL', modify \`deactivation_reason\` varchar(255) default 'NULL', modify \`registration_type\` enum('GOOGLE', 'FACEBOOK', 'APPLE', 'WEB', 'MOBILE') default 'NULL';`);

    this.addSql(`alter table \`apartments\` drop column \`city\`;`);

    this.addSql(`alter table \`apartments\` modify \`apartment_type\` varchar(255) default 'NULL', modify \`space_type_available\` enum('ENTIRE_PLACE', 'ROOM', 'SHARED_ROOM') default 'NULL', modify \`address\` varchar(255) default 'NULL', modify \`amenities\` varchar(255) default 'NULL', modify \`photos\` varchar(255) default 'NULL', modify \`title\` varchar(255) default 'NULL', modify \`highlights\` varchar(255) default 'NULL', modify \`description\` varchar(255) default 'NULL', modify \`reservation_type\` enum('INSTANT_BOOK', 'BOOKING_REQUEST') default 'NULL', modify \`first_reservation_type\` enum('GUEST', 'EXPERIENCED_GUEST') default 'NULL', modify \`allowed_discounts\` varchar(255) default 'NULL', modify \`created_by\` varchar(255) default 'NULL', modify \`status\` enum('PENDING', 'AVAILABLE') default 'NULL';`);

    this.addSql(`alter table \`wishlist\` modify \`title\` varchar(255) default 'NULL', modify \`user\` varchar(255) default 'NULL';`);

    this.addSql(`alter table \`wishlisted_apartments\` modify \`wishlist\` varchar(255) default 'NULL', modify \`apartment\` varchar(255) default 'NULL';`);
  }

}
