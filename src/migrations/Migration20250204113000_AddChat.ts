import { Migration } from '@mikro-orm/migrations';

export class Migration20250204113000_AddChat extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "create table `conversations` (`uuid` varchar(255) not null, `created_at` datetime not null default CURRENT_TIMESTAMP, `updated_at` datetime not null default CURRENT_TIMESTAMP, `deleted_at` datetime null, `type` enum('USER_HOST', 'USER_ADMIN') not null, `user` varchar(255) null, `host` varchar(255) null, `apartment` varchar(255) null, `last_message_at` datetime null, primary key (`uuid`)) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql(
      'alter table `conversations` add index `conversations_user_index`(`user`);',
    );
    this.addSql(
      'alter table `conversations` add index `conversations_host_index`(`host`);',
    );
    this.addSql(
      'alter table `conversations` add index `conversations_apartment_index`(`apartment`);',
    );
    this.addSql(
      "alter table `conversations` add constraint `conversations_user_foreign` foreign key (`user`) references `users` (`uuid`) on update cascade on delete set null;",
    );
    this.addSql(
      "alter table `conversations` add constraint `conversations_host_foreign` foreign key (`host`) references `users` (`uuid`) on update cascade on delete set null;",
    );
    this.addSql(
      "alter table `conversations` add constraint `conversations_apartment_foreign` foreign key (`apartment`) references `apartments` (`uuid`) on update cascade on delete set null;",
    );

    this.addSql(
      "create table `messages` (`uuid` varchar(255) not null, `created_at` datetime not null default CURRENT_TIMESTAMP, `updated_at` datetime not null default CURRENT_TIMESTAMP, `deleted_at` datetime null, `conversation` varchar(255) null, `sender_role` enum('USER', 'HOST', 'ADMIN') not null, `sender_user` varchar(255) null, `sender_admin` varchar(255) null, `content` text not null, primary key (`uuid`)) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql(
      'alter table `messages` add index `messages_conversation_index`(`conversation`);',
    );
    this.addSql(
      'alter table `messages` add index `messages_sender_user_index`(`sender_user`);',
    );
    this.addSql(
      'alter table `messages` add index `messages_sender_admin_index`(`sender_admin`);',
    );
    this.addSql(
      "alter table `messages` add constraint `messages_conversation_foreign` foreign key (`conversation`) references `conversations` (`uuid`) on update cascade on delete set null;",
    );
    this.addSql(
      "alter table `messages` add constraint `messages_sender_user_foreign` foreign key (`sender_user`) references `users` (`uuid`) on update cascade on delete set null;",
    );
    this.addSql(
      "alter table `messages` add constraint `messages_sender_admin_foreign` foreign key (`sender_admin`) references `admin_users` (`uuid`) on update cascade on delete set null;",
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table `messages` drop foreign key `messages_conversation_foreign`;',
    );
    this.addSql(
      'alter table `messages` drop foreign key `messages_sender_user_foreign`;',
    );
    this.addSql(
      'alter table `messages` drop foreign key `messages_sender_admin_foreign`;',
    );
    this.addSql('drop table if exists `messages`;');

    this.addSql(
      'alter table `conversations` drop foreign key `conversations_user_foreign`;',
    );
    this.addSql(
      'alter table `conversations` drop foreign key `conversations_host_foreign`;',
    );
    this.addSql(
      'alter table `conversations` drop foreign key `conversations_apartment_foreign`;',
    );
    this.addSql('drop table if exists `conversations`;');
  }
}
