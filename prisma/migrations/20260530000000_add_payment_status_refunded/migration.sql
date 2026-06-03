-- AlterEnum: Add 'refunded' to PaymentStatus (Stripe charge.refunded handling)
ALTER TYPE "PaymentStatus" ADD VALUE 'refunded';
