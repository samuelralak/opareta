import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePaymentsTable1764095921091 implements MigrationInterface {
    name = 'CreatePaymentsTable1764095921091'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."payments_currency_enum" AS ENUM('UGX', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_payment_method_enum" AS ENUM('MOBILE_MONEY')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reference" character varying NOT NULL, "user_id" uuid NOT NULL, "amount" numeric(18,2) NOT NULL, "currency" "public"."payments_currency_enum" NOT NULL, "payment_method" "public"."payments_payment_method_enum" NOT NULL, "customer_phone" character varying NOT NULL, "customer_email" character varying NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'INITIATED', "provider_reference" character varying, "provider_transaction_id" character varying, "failure_reason" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_866ddee0e17d9385b4e3b86851" ON "payments" ("reference") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_866ddee0e17d9385b4e3b86851"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_payment_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_currency_enum"`);
    }

}
