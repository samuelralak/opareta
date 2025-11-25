import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWebhookEventsTable1764096260081 implements MigrationInterface {
    name = 'CreateWebhookEventsTable1764096260081'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "webhook_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "webhook_id" character varying NOT NULL, "payment_reference" character varying NOT NULL, "payload" jsonb NOT NULL, "processed" boolean NOT NULL DEFAULT false, "received_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4cba37e6a0acb5e1fc49c34ebfd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3b68fc9bae97c699806dd671fb" ON "webhook_events" ("webhook_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_3b68fc9bae97c699806dd671fb"`);
        await queryRunner.query(`DROP TABLE "webhook_events"`);
    }

}
