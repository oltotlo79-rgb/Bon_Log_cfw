-- Add weather location fields to users table
ALTER TABLE "users" ADD COLUMN "weather_prefecture" VARCHAR(10);
ALTER TABLE "users" ADD COLUMN "weather_city" VARCHAR(50);
ALTER TABLE "users" ADD COLUMN "weather_latitude" DECIMAL(8, 5);
ALTER TABLE "users" ADD COLUMN "weather_longitude" DECIMAL(9, 5);
