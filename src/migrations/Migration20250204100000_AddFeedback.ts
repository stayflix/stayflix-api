import { Migration } from '@mikro-orm/migrations';

export class Migration20250204100000_AddFeedback extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "create table `feedback` (`uuid` varchar(255) not null, `created_at` datetime not null default CURRENT_TIMESTAMP, `updated_at` datetime not null default CURRENT_TIMESTAMP, `deleted_at` datetime null, `user` varchar(255) null, `about` varchar(255) not null, `topic` varchar(255) not null, `details` text not null, primary key (`uuid`)) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `feedback` add index `feedback_user_index`(`user`);");
    this.addSql(
      "alter table `feedback` add constraint `feedback_user_foreign` foreign key (`user`) references `users` (`uuid`) on update cascade on delete set null;",
    );
  }

  override async down(): Promise<void> {
    this.addSql("alter table `feedback` drop foreign key `feedback_user_foreign`;");
    this.addSql('drop table if exists `feedback`;');
  }
}
