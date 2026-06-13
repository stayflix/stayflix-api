import { Migration } from '@mikro-orm/migrations';

export class Migration20260613_AddPayOutBookings extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`pay_out_bookings\` (\`uuid\` varchar(255) not null, \`created_at\` datetime not null default CURRENT_TIMESTAMP, \`updated_at\` datetime not null default CURRENT_TIMESTAMP, \`deleted_at\` datetime null, \`payout\` varchar(255) null, \`batch\` varchar(255) null, \`booking\` varchar(255) null, primary key (\`uuid\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`pay_out_bookings\` add index \`pay_out_bookings_payout_index\`(\`payout\`);`);
    this.addSql(`alter table \`pay_out_bookings\` add index \`pay_out_bookings_batch_index\`(\`batch\`);`);
    this.addSql(`alter table \`pay_out_bookings\` add index \`pay_out_bookings_booking_index\`(\`booking\`);`);
    this.addSql(`alter table \`pay_out_bookings\` add constraint \`pay_out_bookings_payout_foreign\` foreign key (\`payout\`) references \`pay_outs\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`pay_out_bookings\` add constraint \`pay_out_bookings_batch_foreign\` foreign key (\`batch\`) references \`pay_out_batches\` (\`uuid\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`pay_out_bookings\` add constraint \`pay_out_bookings_booking_foreign\` foreign key (\`booking\`) references \`bookings\` (\`uuid\`) on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`pay_out_bookings\`;`);
  }

}
