import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAccessTokensTable1764083006472 implements MigrationInterface {
    name = 'CreateAccessTokensTable1764083006472'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "access_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "invalidated_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9bbf8c3c1a897742f78d50e729b" UNIQUE ("token_hash"), CONSTRAINT "PK_65140f59763ff994a0252488166" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "access_tokens" ADD CONSTRAINT "FK_09ee750a035b06e0c7f0704687e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "access_tokens" DROP CONSTRAINT "FK_09ee750a035b06e0c7f0704687e"`);
        await queryRunner.query(`DROP TABLE "access_tokens"`);
    }

}
