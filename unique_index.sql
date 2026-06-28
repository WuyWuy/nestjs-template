-- HUONG GIAI QUYET: Su dung mot Unique Index de tien hanh nap du lieu 
-- docker exec -it <docker_image> psql -U username -d database_name < unique_index.sql 
CREATE UNIQUE INDEX idx_Identity_provider_providerUserId 
ON "Identity"("provider","providerUserId")  
WHERE "deleteAt" is NULL; 

CREATE UNIQUE INDEX idx_Identity_userId_provider 
ON "Identity"("userId", "provider") 
WHERE "deleteAt" IS NULL; 

CREATE UNIQUE INDEX idx_Conversation_customerId_sellerId
ON "Conversation"("customerId","sellerId")
WHERE "deleteAt" IS NULL;

CREATE UNIQUE INDEX idx_FoodIngredient_foodId_ingredientId 
ON "FoodIngredient"("ingredientId","foodId")  
WHERE "deleteAt" IS NULL; 

CREATE UNIQUE INDEX idx_payment_orderId_method 
ON "Payment"("orderId","method") 
WHERE "deleteAt" IS NULL; 

CREATE UNIQUE INDEX idx_restaurant_phone 
ON "Restaurant"("phone") 
WHERE "deleteAt" IS NULL; 

